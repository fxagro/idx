"""
Utility functions for BJB Sekuritas Telegram Bot
Contains helpers, decorators, error handling, and logging utilities
"""

import asyncio
import logging
import functools
import time
import io
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from functools import wraps

import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from telegram import Update
from telegram.ext import ContextTypes

from config import (
    LOG_CONFIG, DEFAULT_BALANCE, CACHE_DURATION_MINUTES,
    MAX_ACCESS_COUNT, MAX_MESSAGE_LENGTH, MOTIVATIONS
)
from enums import MenuState, SubscriptionType, ErrorType, LogLevel
from db_utils import get_cached_data, set_cached_data

# Setup logging
logging.basicConfig(**LOG_CONFIG)
logger = logging.getLogger(__name__)

class BotError(Exception):
    """Base exception for bot errors"""
    def __init__(self, message: str, error_type: ErrorType = ErrorType.UNKNOWN_ERROR):
        super().__init__(message)
        self.error_type = error_type

class DatabaseError(BotError):
    """Database related errors"""
    def __init__(self, message: str):
        super().__init__(message, ErrorType.DATABASE_ERROR)

class APIError(BotError):
    """API related errors"""
    def __init__(self, message: str):
        super().__init__(message, ErrorType.API_ERROR)

class ValidationError(BotError):
    """Validation related errors"""
    def __init__(self, message: str):
        super().__init__(message, ErrorType.VALIDATION_ERROR)

class PermissionError(BotError):
    """Permission related errors"""
    def __init__(self, message: str):
        super().__init__(message, ErrorType.PERMISSION_ERROR)

def safe_log(message: str) -> str:
    """Safely encode log messages to avoid Unicode errors"""
    try:
        return message.encode("utf-8", errors="ignore").decode("utf-8")
    except Exception:
        return str(message)

def log_execution(func: Callable) -> Callable:
    """Decorator to log function execution"""
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        func_name = func.__name__
        user_id = update.effective_user.id if update.effective_user else "Unknown"

        logger.info(safe_log(f"Executing {func_name} for user {user_id}"))

        start_time = time.time()
        try:
            result = await func(update, context, *args, **kwargs)
            execution_time = time.time() - start_time
            logger.info(safe_log(f"{func_name} completed in {execution_time:.2f}s for user {user_id}"))
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(safe_log(f"{func_name} failed after {execution_time:.2f}s for user {user_id}: {str(e)}"))
            raise

    return wrapper

def require_access(min_level: SubscriptionType = SubscriptionType.FREE) -> Callable:
    """Decorator to require minimum subscription level"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            user_id = update.effective_user.id

            try:
                from db_utils import check_user_access
                has_access, reason = await check_user_access(user_id)

                if not has_access:
                    if reason == "access_limit_reached":
                        await update.message.reply_text(
                            "Anda telah mencapai batas akses gratis (3 kali/hari). "
                            "Untuk akses penuh, buka akun RDN di BJB Sekuritas atau berlangganan premium.\n"
                            "Kunjungi: https://opening-jb.bofis.id/#/",
                            parse_mode="Markdown"
                        )
                    else:
                        await update.message.reply_text(
                            "Terjadi kesalahan saat memeriksa akses. Silakan coba lagi nanti.",
                            parse_mode="Markdown"
                        )
                    return

                return await func(update, context, *args, **kwargs)

            except Exception as e:
                logger.error(safe_log(f"Error checking access for user {user_id}: {str(e)}"))
                await update.message.reply_text(
                    "Terjadi kesalahan saat memeriksa akses. Silakan coba lagi nanti.",
                    parse_mode="Markdown"
                )
                return

        return wrapper
    return decorator

def handle_errors(error_message: str = "Terjadi kesalahan. Silakan coba lagi.") -> Callable:
    """Decorator to handle errors gracefully"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            try:
                return await func(update, context, *args, **kwargs)
            except BotError as e:
                logger.error(safe_log(f"Bot error in {func.__name__}: {str(e)}"))
                await update.message.reply_text(
                    f"Error: {str(e)}",
                    parse_mode="Markdown"
                )
            except Exception as e:
                logger.error(safe_log(f"Unexpected error in {func.__name__}: {str(e)}"))
                await update.message.reply_text(
                    error_message,
                    parse_mode="Markdown"
                )
            return None
        return wrapper
    return decorator

def validate_ticker(func: Callable) -> Callable:
    """Decorator to validate ticker symbols"""
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        if not context.args:
            await update.message.reply_text(
                "Silakan masukkan kode saham yang valid.\nContoh: /c BBRI",
                parse_mode="Markdown"
            )
            return

        ticker = context.args[0].upper()
        from config import INDEX_STOCKS

        valid_tickers = set()
        for index_stocks in INDEX_STOCKS.values():
            valid_tickers.update(index_stocks.keys())

        if ticker not in valid_tickers:
            await update.message.reply_text(
                f"Kode saham '{ticker}' tidak ditemukan. Silakan periksa kode saham yang benar.",
                parse_mode="Markdown"
            )
            return

        # Add validated ticker to context
        context.validated_ticker = ticker
        return await func(update, context, *args, **kwargs)

    return wrapper

def rate_limit(max_calls: int = 3, period: int = 3600) -> Callable:
    """Decorator to rate limit function calls"""
    calls = {}

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            user_id = update.effective_user.id
            now = time.time()

            if user_id not in calls:
                calls[user_id] = []

            # Remove old calls outside the period
            calls[user_id] = [call_time for call_time in calls[user_id] if now - call_time < period]

            if len(calls[user_id]) >= max_calls:
                await update.message.reply_text(
                    f"Anda telah mencapai batas maksimal {max_calls} panggilan dalam {period//60} menit.",
                    parse_mode="Markdown"
                )
                return

            calls[user_id].append(now)
            return await func(update, context, *args, **kwargs)

        return wrapper
    return decorator

def cache_result(ttl_seconds: int = 300) -> Callable:
    """Decorator to cache function results"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{':'.join(str(arg) for arg in args)}"

            # Try to get cached result
            cached_result = await get_cached_data(cache_key, ttl_seconds)
            if cached_result is not None:
                logger.debug(safe_log(f"Using cached result for {cache_key}"))
                return cached_result

            # Execute function and cache result
            result = await func(update, context, *args, **kwargs)
            await set_cached_data(cache_key, result)

            return result

        return wrapper
    return decorator

def format_number(value: Union[int, float], precision: int = 2) -> str:
    """Format number with appropriate suffix"""
    try:
        if pd.isna(value) or value is None:
            return "N/A"

        abs_value = abs(value)

        if abs_value >= 1_000_000_000_000:
            return f"{value / 1_000_000_000_000:.1f}T"
        elif abs_value >= 1_000_000_000:
            return f"{value / 1_000_000_000:.1f}B"
        elif abs_value >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        else:
            return f"{value:,.0f}"

    except Exception as e:
        logger.error(safe_log(f"Error formatting number {value}: {str(e)}"))
        return str(value)

def format_percentage(value: Union[int, float], precision: int = 2) -> str:
    """Format percentage value"""
    try:
        if pd.isna(value) or value is None:
            return "N/A"

        return f"{value:+.2f}%"

    except Exception as e:
        logger.error(safe_log(f"Error formatting percentage {value}: {str(e)}"))
        return str(value)

def create_progress_message(current: int, total: int, operation: str = "Processing") -> str:
    """Create progress message"""
    if total == 0:
        return f"{operation}: {current} completed"

    percentage = (current / total) * 100
    return f"{operation}: {current}/{total} ({percentage:.1f}%) completed"

def split_message(message: str, max_length: int = MAX_MESSAGE_LENGTH) -> List[str]:
    """Split long message into multiple parts"""
    if len(message) <= max_length:
        return [message]

    parts = []
    while len(message) > max_length:
        # Find last newline before max_length
        split_point = message.rfind('\n', 0, max_length)
        if split_point == -1:
            split_point = max_length

        parts.append(message[:split_point])
        message = message[split_point:].lstrip()

    if message:
        parts.append(message)

    return parts

def get_random_motivation() -> str:
    """Get random motivational message"""
    import random
    return random.choice(MOTIVATIONS)

def validate_date(date_str: str, format_str: str = "%Y-%m-%d") -> bool:
    """Validate date string format"""
    try:
        datetime.strptime(date_str, format_str)
        return True
    except ValueError:
        return False

def parse_date_range(start_date: str, end_date: str) -> Tuple[datetime, datetime]:
    """Parse and validate date range"""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        if end <= start:
            raise ValidationError("End date must be after start date")

        return start, end

    except ValueError as e:
        raise ValidationError(f"Invalid date format: {str(e)}")

def calculate_percentage_change(old_value: float, new_value: float) -> float:
    """Calculate percentage change between two values"""
    try:
        if old_value == 0:
            return 0.0
        return ((new_value - old_value) / old_value) * 100
    except Exception as e:
        logger.error(safe_log(f"Error calculating percentage change: {str(e)}"))
        return 0.0

def format_currency(value: float, currency: str = "Rp") -> str:
    """Format currency value"""
    try:
        if pd.isna(value) or value is None:
            return f"{currency} N/A"
        return f"{currency} {value:,.0f}"
    except Exception as e:
        logger.error(safe_log(f"Error formatting currency {value}: {str(e)}"))
        return f"{currency} {value}"

def create_table_image(headers: List[str], data: List[List[str]],
                      title: str = "", max_width: int = 800) -> io.BytesIO:
    """Create table image from data"""
    try:
        import matplotlib.pyplot as plt
        from matplotlib.table import Table

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.axis('tight')
        ax.axis('off')

        # Create table
        table = Table(ax, bbox=[0, 0, 1, 1])

        # Add headers
        for i, header in enumerate(headers):
            table.add_cell(0, i, width=1/len(headers), height=0.1,
                         text=header, loc='center',
                         facecolor='lightblue', edges='open')

        # Add data rows
        for row_idx, row in enumerate(data[:20]):  # Limit to 20 rows
            for col_idx, cell in enumerate(row):
                table.add_cell(row_idx + 1, col_idx, width=1/len(headers), height=0.05,
                             text=str(cell), loc='center', edges='open')

        ax.add_table(table)

        if title:
            ax.set_title(title, fontsize=14, pad=20)

        # Save to buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        plt.close(fig)

        return buf

    except Exception as e:
        logger.error(safe_log(f"Error creating table image: {str(e)}"))
        raise

def clean_text(text: str) -> str:
    """Clean text for safe display"""
    try:
        # Remove potentially harmful characters
        cleaned = text.replace('\x00', '').replace('\r', '').replace('\n', ' ')
        return cleaned[:1000]  # Limit length
    except Exception as e:
        logger.error(safe_log(f"Error cleaning text: {str(e)}"))
        return "Error cleaning text"

def get_greeting() -> str:
    """Get time-based greeting"""
    try:
        from datetime import datetime
        hour = datetime.now().hour

        if 0 <= hour < 12:
            return "Selamat Pagi"
        elif 12 <= hour < 15:
            return "Selamat Siang"
        elif 15 <= hour < 18:
            return "Selamat Sore"
        else:
            return "Selamat Malam"

    except Exception as e:
        logger.error(safe_log(f"Error getting greeting: {str(e)}"))
        return "Selamat Datang"

def validate_input_length(text: str, max_length: int = 100) -> bool:
    """Validate input text length"""
    return len(text.strip()) <= max_length

def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe file operations"""
    try:
        # Remove or replace invalid characters
        sanitized = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
        return sanitized[:100]  # Limit length
    except Exception as e:
        logger.error(safe_log(f"Error sanitizing filename {filename}: {str(e)}"))
        return "default_filename"

def retry_async(max_attempts: int = 3, delay: float = 1.0) -> Callable:
    """Decorator to retry async functions on failure"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        logger.warning(safe_log(f"Attempt {attempt + 1} failed for {func.__name__}, retrying in {delay}s"))
                        await asyncio.sleep(delay)
                        delay *= 2  # Exponential backoff

            logger.error(safe_log(f"All {max_attempts} attempts failed for {func.__name__}: {str(last_exception)}"))
            raise last_exception

        return wrapper
    return decorator

def measure_execution_time(func: Callable) -> Callable:
    """Decorator to measure function execution time"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            logger.info(safe_log(f"{func.__name__} executed in {execution_time:.2f}s"))
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(safe_log(f"{func.__name__} failed after {execution_time:.2f}s: {str(e)}"))
            raise

    return wrapper

def debounce(wait_seconds: float = 1.0) -> Callable:
    """Decorator to debounce function calls"""
    def decorator(func: Callable) -> Callable:
        last_called = {}

        @wraps(func)
        async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
            user_id = update.effective_user.id
            now = time.time()

            if user_id in last_called:
                time_since_last_call = now - last_called[user_id]
                if time_since_last_call < wait_seconds:
                    logger.debug(safe_log(f"Debouncing {func.__name__} for user {user_id}"))
                    return

            last_called[user_id] = now
            return await func(update, context, *args, **kwargs)

        return wrapper
    return decorator

def format_table_data(headers: List[str], rows: List[List[Any]]) -> str:
    """Format data as markdown table"""
    try:
        if not rows:
            return "No data available"

        # Create table
        table = f"| {' | '.join(headers)} |\n"
        table += f"| {' | '.join('-' * len(header) for header in headers)} |\n"

        for row in rows[:50]:  # Limit to 50 rows
            formatted_row = []
            for cell in row:
                cell_str = str(cell) if cell is not None else "N/A"
                # Escape markdown special characters
                cell_str = cell_str.replace('|', '\\|').replace('_', '\\_')
                formatted_row.append(cell_str[:50])  # Limit cell length

            table += f"| {' | '.join(formatted_row)} |\n"

        return table

    except Exception as e:
        logger.error(safe_log(f"Error formatting table: {str(e)}"))
        return "Error formatting table"

def calculate_moving_average(data: List[float], period: int) -> List[float]:
    """Calculate moving average"""
    try:
        if len(data) < period:
            return []

        ma_values = []
        for i in range(period - 1, len(data)):
            ma_values.append(sum(data[i-period+1:i+1]) / period)

        return ma_values

    except Exception as e:
        logger.error(safe_log(f"Error calculating moving average: {str(e)}"))
        return []

def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
    """Calculate RSI values"""
    try:
        if len(prices) < period + 1:
            return []

        gains = []
        losses = []

        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            gains.append(max(change, 0))
            losses.append(abs(min(change, 0)))

        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        rsi_values = []

        for i in range(period, len(gains)):
            if avg_loss != 0:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
            else:
                rsi = 100

            rsi_values.append(rsi)

            # Update averages
            if i < len(gains) - 1:
                change = gains[i] if gains[i] > 0 else 0
                loss_change = losses[i] if losses[i] > 0 else 0

                avg_gain = (avg_gain * (period - 1) + change) / period
                avg_loss = (avg_loss * (period - 1) + loss_change) / period

        return rsi_values

    except Exception as e:
        logger.error(safe_log(f"Error calculating RSI: {str(e)}"))
        return []

def detect_candlestick_pattern(high: float, low: float, open_price: float, close: float) -> str:
    """Detect basic candlestick patterns"""
    try:
        body = abs(close - open_price)
        total_range = high - low
        upper_shadow = high - max(open_price, close)
        lower_shadow = min(open_price, close) - low

        if total_range == 0:
            return "Unknown"

        # Doji detection
        if body / total_range < 0.05:
            return "Doji"

        # Hammer detection
        if lower_shadow > body * 2 and upper_shadow < body * 0.1:
            return "Hammer"

        # Shooting Star detection
        if upper_shadow > body * 2 and lower_shadow < body * 0.1:
            return "Shooting Star"

        # Bullish engulfing (simplified)
        if close > open_price and body > total_range * 0.6:
            return "Bullish"

        # Bearish engulfing (simplified)
        if close < open_price and body > total_range * 0.6:
            return "Bearish"

        return "Unknown"

    except Exception as e:
        logger.error(safe_log(f"Error detecting candlestick pattern: {str(e)}"))
        return "Unknown"

def calculate_volatility(prices: List[float], period: int = 20) -> float:
    """Calculate volatility (standard deviation of returns)"""
    try:
        if len(prices) < period + 1:
            return 0.0

        returns = []
        for i in range(1, len(prices)):
            if prices[i-1] != 0:
                returns.append((prices[i] - prices[i-1]) / prices[i-1])

        if len(returns) < 2:
            return 0.0

        return np.std(returns) * np.sqrt(252)  # Annualized

    except Exception as e:
        logger.error(safe_log(f"Error calculating volatility: {str(e)}"))
        return 0.0

def format_time_remaining(seconds: float) -> str:
    """Format time remaining in human readable format"""
    try:
        if seconds < 60:
            return f"{int(seconds)} detik"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            remaining_seconds = int(seconds % 60)
            return f"{minutes} menit {remaining_seconds} detik"
        else:
            hours = int(seconds // 3600)
            remaining_minutes = int((seconds % 3600) // 60)
            return f"{hours} jam {remaining_minutes} menit"

    except Exception as e:
        logger.error(safe_log(f"Error formatting time: {str(e)}"))
        return f"{int(seconds)}s"

def is_market_open() -> bool:
    """Check if market is currently open"""
    try:
        from datetime import datetime
        now = datetime.now()

        # Market hours: Monday-Friday, 09:00-16:00 WIB
        if now.weekday() >= 5:  # Saturday or Sunday
            return False

        market_start = now.replace(hour=9, minute=0, second=0, microsecond=0)
        market_end = now.replace(hour=16, minute=0, second=0, microsecond=0)

        return market_start <= now <= market_end

    except Exception as e:
        logger.error(safe_log(f"Error checking market hours: {str(e)}"))
        return False

def get_next_market_open() -> datetime:
    """Get next market open time"""
    try:
        from datetime import datetime, timedelta
        now = datetime.now()

        # Find next Monday if it's weekend
        days_ahead = (7 - now.weekday()) % 7
        if days_ahead == 0 and not is_market_open():
            days_ahead = 7

        next_open = now + timedelta(days=days_ahead)
        next_open = next_open.replace(hour=9, minute=0, second=0, microsecond=0)

        return next_open

    except Exception as e:
        logger.error(safe_log(f"Error getting next market open: {str(e)}"))
        return datetime.now()

def create_loading_message(operation: str) -> str:
    """Create loading message"""
    return f"⏳ {operation}... Mohon tunggu sebentar."

def create_error_message(error: str) -> str:
    """Create error message"""
    return f"❌ Error: {error}\n\nSilakan coba lagi atau hubungi admin jika masalah berlanjut."

def create_success_message(message: str) -> str:
    """Create success message"""
    return f"✅ {message}"

def validate_numeric_input(value: str, min_value: Optional[float] = None,
                          max_value: Optional[float] = None) -> float:
    """Validate and convert numeric input"""
    try:
        num_value = float(value)

        if min_value is not None and num_value < min_value:
            raise ValidationError(f"Value must be at least {min_value}")

        if max_value is not None and num_value > max_value:
            raise ValidationError(f"Value must be at most {max_value}")

        return num_value

    except ValueError:
        raise ValidationError("Invalid numeric value")

def chunk_list(data: List[Any], chunk_size: int) -> List[List[Any]]:
    """Split list into chunks"""
    try:
        return [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
    except Exception as e:
        logger.error(safe_log(f"Error chunking list: {str(e)}"))
        return [data]

def calculate_trend(data: List[float]) -> str:
    """Calculate trend from data"""
    try:
        if len(data) < 2:
            return "Insufficient data"

        first_value = data[0]
        last_value = data[-1]

        if last_value > first_value:
            return "Upward"
        elif last_value < first_value:
            return "Downward"
        else:
            return "Sideways"

    except Exception as e:
        logger.error(safe_log(f"Error calculating trend: {str(e)}"))
        return "Unknown"

def get_performance_color(performance: float) -> str:
    """Get color emoji based on performance"""
    try:
        if performance > 5:
            return "🟢"  # Strong positive
        elif performance > 0:
            return "🟡"  # Positive
        elif performance > -5:
            return "🟠"  # Negative
        else:
            return "🔴"  # Strong negative

    except Exception as e:
        logger.error(safe_log(f"Error getting performance color: {str(e)}"))
        return "⚪"

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    try:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes/1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes/(1024*1024):.1f} MB"
        else:
            return f"{size_bytes/(1024*1024*1024):.1f} GB"

    except Exception as e:
        logger.error(safe_log(f"Error formatting file size: {str(e)}"))
        return f"{size_bytes} bytes"

def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division that handles division by zero"""
    try:
        return numerator / denominator if denominator != 0 else default
    except Exception as e:
        logger.error(safe_log(f"Error in safe division: {str(e)}"))
        return default

def exponential_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0) -> float:
    """Calculate exponential backoff delay"""
    try:
        delay = base_delay * (2 ** attempt)
        return min(delay, max_delay)
    except Exception as e:
        logger.error(safe_log(f"Error calculating backoff: {str(e)}"))
        return base_delay

def is_valid_email(email: str) -> bool:
    """Validate email format"""
    try:
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    except Exception as e:
        logger.error(safe_log(f"Error validating email: {str(e)}"))
        return False

def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to max length"""
    try:
        if len(text) <= max_length:
            return text
        return text[:max_length - len(suffix)] + suffix
    except Exception as e:
        logger.error(safe_log(f"Error truncating text: {str(e)}"))
        return text

def get_memory_usage() -> str:
    """Get current memory usage"""
    try:
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        return format_file_size(memory_info.rss)
    except ImportError:
        return "N/A (psutil not installed)"
    except Exception as e:
        logger.error(safe_log(f"Error getting memory usage: {str(e)}"))
        return "N/A"

def cleanup_temp_files(directory: str = "/tmp", pattern: str = "*.png", max_age_hours: int = 1):
    """Clean up temporary files"""
    try:
        import glob
        from datetime import datetime, timedelta

        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

        for file_path in glob.glob(f"{directory}/{pattern}"):
            try:
                file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_modified < cutoff_time:
                    os.remove(file_path)
                    logger.debug(safe_log(f"Removed old temp file: {file_path}"))
            except Exception as e:
                logger.warning(safe_log(f"Error removing temp file {file_path}: {str(e)}"))

    except Exception as e:
        logger.error(safe_log(f"Error cleaning temp files: {str(e)}"))

# Async utilities
async def async_sleep(seconds: float):
    """Async sleep function"""
    await asyncio.sleep(seconds)

async def run_in_executor(func: Callable, *args, **kwargs):
    """Run function in thread executor"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, func, *args, **kwargs)

async def gather_with_limit(limit: int, *coros):
    """Run coroutines with concurrency limit"""
    semaphore = asyncio.Semaphore(limit)

    async def limited_coro(coro):
        async with semaphore:
            return await coro

    return await asyncio.gather(*[limited_coro(coro) for coro in coros])

# Context manager utilities
class Timer:
    """Context manager for timing operations"""
    def __init__(self, name: str = "Operation"):
        self.name = name
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = time.time() - self.start_time
            logger.info(safe_log(f"{self.name} completed in {duration:.2f}s"))

class TempFile:
    """Context manager for temporary files"""
    def __init__(self, suffix: str = ".tmp"):
        self.suffix = suffix
        self.file_path = None

    def __enter__(self):
        import tempfile
        self.file_path = tempfile.mktemp(suffix=self.suffix)
        return self.file_path

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file_path and os.path.exists(self.file_path):
            try:
                os.remove(self.file_path)
            except Exception as e:
                logger.warning(safe_log(f"Error removing temp file {self.file_path}: {str(e)}"))

# Validation utilities
def validate_ticker_symbol(ticker: str) -> bool:
    """Validate ticker symbol format"""
    try:
        if not ticker or len(ticker) < 2 or len(ticker) > 5:
            return False

        # Should contain only letters and numbers
        return ticker.isalnum()

    except Exception as e:
        logger.error(safe_log(f"Error validating ticker {ticker}: {str(e)}"))
        return False

def validate_date_range(start_date: str, end_date: str) -> bool:
    """Validate date range"""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        return end > start

    except Exception as e:
        logger.error(safe_log(f"Error validating date range: {str(e)}"))
        return False

def validate_percentage(value: float) -> bool:
    """Validate percentage value"""
    try:
        return -1000 <= value <= 1000  # Reasonable range
    except Exception as e:
        logger.error(safe_log(f"Error validating percentage: {str(e)}"))
        return False

# String utilities
def remove_markdown(text: str) -> str:
    """Remove markdown formatting"""
    try:
        import re
        # Remove common markdown characters
        text = re.sub(r'[*_`~]', '', text)
        return text
    except Exception as e:
        logger.error(safe_log(f"Error removing markdown: {str(e)}"))
        return text

def escape_markdown(text: str) -> str:
    """Escape markdown special characters"""
    try:
        import re
        # Escape markdown special characters
        return re.sub(r'([*_`~[\]()])', r'\\\1', text)
    except Exception as e:
        logger.error(safe_log(f"Error escaping markdown: {str(e)}"))
        return text

def normalize_whitespace(text: str) -> str:
    """Normalize whitespace in text"""
    try:
        import re
        return re.sub(r'\s+', ' ', text).strip()
    except Exception as e:
        logger.error(safe_log(f"Error normalizing whitespace: {str(e)}"))
        return text

# Math utilities
def calculate_compound_interest(principal: float, rate: float, years: int) -> float:
    """Calculate compound interest"""
    try:
        return principal * (1 + rate) ** years
    except Exception as e:
        logger.error(safe_log(f"Error calculating compound interest: {str(e)}"))
        return principal

def calculate_portfolio_return(values: List[float], weights: List[float]) -> float:
    """Calculate portfolio weighted return"""
    try:
        if len(values) != len(weights):
            raise ValidationError("Values and weights must have same length")

        return sum(v * w for v, w in zip(values, weights))

    except Exception as e:
        logger.error(safe_log(f"Error calculating portfolio return: {str(e)}"))
        return 0.0

def calculate_sharpe_ratio(returns: List[float], risk_free_rate: float = 0.02) -> float:
    """Calculate Sharpe ratio"""
    try:
        if len(returns) < 2:
            return 0.0

        avg_return = np.mean(returns)
        std_return = np.std(returns)

        if std_return == 0:
            return 0.0

        return (avg_return - risk_free_rate) / std_return

    except Exception as e:
        logger.error(safe_log(f"Error calculating Sharpe ratio: {str(e)}"))
        return 0.0

# File utilities
def ensure_directory(path: str):
    """Ensure directory exists"""
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as e:
        logger.error(safe_log(f"Error creating directory {path}: {str(e)}"))
        raise

def safe_file_write(file_path: str, content: str):
    """Safely write content to file"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        logger.error(safe_log(f"Error writing to file {file_path}: {str(e)}"))
        raise

def safe_file_read(file_path: str) -> str:
    """Safely read content from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(safe_log(f"Error reading from file {file_path}: {str(e)}"))
        return ""

# Network utilities
def is_connected() -> bool:
    """Check if internet connection is available"""
    try:
        import requests
        response = requests.get("https://www.google.com", timeout=5)
        return response.status_code == 200
    except Exception:
        return False

def retry_request(url: str, max_retries: int = 3, delay: float = 1.0) -> Optional[requests.Response]:
    """Retry HTTP request"""
    try:
        import requests

        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                return response
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(delay)
                    delay *= 2

        logger.error(safe_log(f"Failed to fetch {url} after {max_retries} attempts"))
        return None

    except Exception as e:
        logger.error(safe_log(f"Error in retry request: {str(e)}"))
        return None

# Performance monitoring
class PerformanceMonitor:
    """Monitor function performance"""

    def __init__(self):
        self.metrics = {}

    def record(self, function_name: str, execution_time: float):
        """Record function execution time"""
        if function_name not in self.metrics:
            self.metrics[function_name] = []

        self.metrics[function_name].append(execution_time)

        # Keep only last 100 records
        if len(self.metrics[function_name]) > 100:
            self.metrics[function_name] = self.metrics[function_name][-100:]

    def get_stats(self, function_name: str) -> Dict[str, float]:
        """Get performance statistics for a function"""
        if function_name not in self.metrics:
            return {}

        times = self.metrics[function_name]
        return {
            'count': len(times),
            'avg_time': sum(times) / len(times),
            'min_time': min(times),
            'max_time': max(times)
        }

# Global performance monitor
performance_monitor = PerformanceMonitor()

def monitor_performance(func: Callable) -> Callable:
    """Decorator to monitor function performance"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            performance_monitor.record(func.__name__, execution_time)
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            performance_monitor.record(func.__name__, execution_time)
            raise

    return wrapper

# Export utilities
__all__ = [
    'BotError', 'DatabaseError', 'APIError', 'ValidationError', 'PermissionError',
    'safe_log', 'log_execution', 'require_access', 'handle_errors', 'validate_ticker',
    'rate_limit', 'cache_result', 'format_number', 'format_percentage',
    'create_progress_message', 'split_message', 'get_random_motivation',
    'validate_date', 'parse_date_range', 'calculate_percentage_change',
    'format_currency', 'create_table_image', 'clean_text', 'get_greeting',
    'validate_input_length', 'sanitize_filename', 'retry_async',
    'measure_execution_time', 'debounce', 'format_table_data',
    'calculate_moving_average', 'calculate_rsi', 'detect_candlestick_pattern',
    'calculate_volatility', 'format_time_remaining', 'is_market_open',
    'get_next_market_open', 'create_loading_message', 'create_error_message',
    'create_success_message', 'validate_numeric_input', 'chunk_list',
    'calculate_trend', 'get_performance_color', 'format_file_size',
    'safe_divide', 'exponential_backoff', 'is_valid_email', 'truncate_text',
    'get_memory_usage', 'cleanup_temp_files', 'async_sleep', 'run_in_executor',
    'gather_with_limit', 'Timer', 'TempFile', 'validate_ticker_symbol',
    'validate_date_range', 'validate_percentage', 'remove_markdown',
    'escape_markdown', 'normalize_whitespace', 'calculate_compound_interest',
    'calculate_portfolio_return', 'calculate_sharpe_ratio', 'ensure_directory',
    'safe_file_write', 'safe_file_read', 'is_connected', 'retry_request',
    'PerformanceMonitor', 'performance_monitor', 'monitor_performance'
]