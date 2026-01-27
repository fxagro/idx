"""
Feature functions for BJB Sekuritas Telegram Bot
Contains grouped functions like top_gainers variants, predictions, simulations
"""

import asyncio
import logging
import io
import os
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error

try:
    from arch import arch_model
    ARCH_AVAILABLE = True
except ImportError:
    ARCH_AVAILABLE = False

try:
    from tensorflow.keras.models import Sequential, load_model
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from sklearn.preprocessing import MinMaxScaler
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False

try:
    from pmdarima import auto_arima
    PMDARIMA_AVAILABLE = True
except ImportError:
    PMDARIMA_AVAILABLE = False

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    from ta.trend import macd, sma, ema
    from ta.momentum import rsi, stochastic
    from ta.volatility import bollinger_bands, average_true_range
    from ta.volume import on_balance_volume, volume_weighted_average_price
    TA_AVAILABLE = True
except ImportError:
    TA_AVAILABLE = False

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    VADER_AVAILABLE = True
except ImportError:
    VADER_AVAILABLE = False

import yfinance as yf
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from config import (
    DATABASE_PATH, DB_NAME, CMC_API_KEY, NEWS_API_KEY,
    LQ45_STOCKS, KOMPAS100_STOCKS, JII70_STOCKS, MBX_STOCKS, ISSI_STOCKS,
    INDEX_STOCKS, INDICES, SECTORS, MAJOR_CURRENCIES, COMMODITIES,
    GLOBAL_INDICES, ADMIN_IDS
)
from enums import SubscriptionType, ErrorType
from utils import (
    safe_log, format_number, format_percentage, format_currency,
    create_table_image, split_message, calculate_percentage_change,
    validate_date, parse_date_range, chunk_list, retry_async,
    handle_errors, require_access, log_execution, cache_result
)
from db_utils import (
    get_db_connection, get_stock_data, save_stock_data,
    get_fundamental_data, save_fundamental_data,
    get_news_data, save_news_data, get_latest_crypto_data,
    save_crypto_data, get_user_accounts, save_user_accounts
)
from menus import (
    show_error_message, show_loading_message, show_success_message,
    show_data_not_found_message, show_premium_required_message
)

# Setup logging
logger = logging.getLogger(__name__)

# Global variables
DB_CONNECTION = None

# Stock Analysis Features
@require_access(SubscriptionType.FREE)
@log_execution
async def check_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check stock data"""
    try:
        if not context.args:
            await update.message.reply_text(
                "Masukkan kode saham, contoh: /c BJBR",
                parse_mode="Markdown"
            )
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, CompanyName, Close, Open, High, Low, Volume FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 1",
                (ticker,)
            )
            row = await cursor.fetchone()

        if not row:
            await update.message.reply_text(
                f"Tidak ada data untuk saham {ticker}. Pastikan kode saham benar dan data tersedia.",
                parse_mode="Markdown"
            )
            return

        date, company_name, close, open_price, high, low, volume = row

        # Get company name from config if not in database
        if not company_name or company_name == "Nama tidak tersedia":
            for index_stocks in INDEX_STOCKS.values():
                if ticker in index_stocks:
                    company_name = index_stocks[ticker]
                    break

        message = (
            f"📊 *{ticker} - {company_name}*\n"
            f"Tanggal: {date}\n"
            f"Close: {close:.2f}\n"
            f"Open: {open_price:.2f}\n"
            f"High: {high:.2f}\n"
            f"Low: {low:.2f}\n"
            f"Volume: {int(volume):,}"
        )

        await update.message.reply_text(message, parse_mode="Markdown")
        logger.info(safe_log(f"Stock data sent for {ticker}"))

    except Exception as e:
        logger.error(safe_log(f"Error in check_stock: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data saham")

@require_access(SubscriptionType.FREE)
@log_execution
async def top_gainers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top gainers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df = df.dropna().nlargest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot = df_pivot.nlargest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📈 *Top Gainers ({period if is_date else period})*:\n\n"
        keyboard = []

        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                company_name = row['CompanyName']

            message += f"{ticker} ({company_name}): {change:.2f}%\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change:.2f}%", callback_data=f"tg_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_gainers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top gainers")

@require_access(SubscriptionType.FREE)
@log_execution
async def top_losers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top losers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open, Volume FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL AND Volume IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open', 'Volume'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df['TransactionValue'] = df['Close'] * df['Volume']
                df = df.dropna().nsmallest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Volume FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL AND Volume IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Volume'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Volume'] = df.groupby('Ticker')['Volume'].last()
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot['TransactionValue'] = df_pivot[end_date] * df_pivot['Volume']
                df_pivot = df_pivot.dropna().nsmallest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📉 *Top Losers ({period if is_date else period})*:\n\n"
        message += f"| Ticker      | Company Name         | Change (%) | Close     | Value (Rp)  |\n"
        message += f"|-------------|----------------------|------------|-----------|-------------|\n"

        keyboard = []
        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                close = row['Close']
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                close = row[end_date]
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']

            # Format transaction value
            if trans_value >= 1_000_000_000_000:
                trans_str = f"{trans_value / 1_000_000_000_000:.2f} T"
            elif trans_value >= 1_000_000_000:
                trans_str = f"{trans_value / 1_000_000_000:.2f} B"
            elif trans_value >= 1_000_000:
                trans_str = f"{trans_value / 1_000_000:.2f} M"
            else:
                trans_str = f"{trans_value:,.2f}"

            message += f"| {ticker:<11} | {company_name[:18]:<20} | {change:>10.2f}% | {close:>9,.2f} | {trans_str:>11} |\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change:.2f}%", callback_data=f"tl_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_losers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top losers")

@require_access(SubscriptionType.FREE)
@log_execution
async def top_crypto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top crypto data"""
    try:
        async with get_db_connection(DB_NAME) as conn:
            cursor = await conn.execute(
                "SELECT MAX(timestamp) FROM metadata"
            )
            latest_timestamp = await cursor.fetchone()

            if not latest_timestamp:
                await update.message.reply_text("Data cryptocurrency tidak ditemukan. Memperbarui data sekarang...")
                await update_crypto_data(context)
                return

            timestamp = latest_timestamp[0]
            cursor = await conn.execute(
                "SELECT symbol, name, price_usd, market_cap, percent_change_24h FROM coins WHERE timestamp = ? ORDER BY market_cap DESC LIMIT 10",
                (timestamp,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text("Tidak ada data cryptocurrency yang tersedia saat ini.")
            return

        message = "💰 *Top 10 Cryptocurrencies by Market Cap*:\n\n"
        for row in rows:
            symbol, name, price, market_cap, change = row
            message += f"{name} ({symbol})\nHarga: ${price:,.2f}\nMarket Cap: ${market_cap:,.0f}\nPerubahan 24h: {change:+.2f}%\n\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_crypto: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data crypto")

@require_access(SubscriptionType.FREE)
@log_execution
async def global_indices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get global indices data"""
    try:
        indices_data = []

        for name, symbol in GLOBAL_INDICES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    indices_data.append({
                        "Index": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if len(indices_data) < 3:
            await update.message.reply_text("Data indeks global tidak cukup. Silakan coba lagi nanti.")
            return

        df = pd.DataFrame(indices_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Index'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            plt.text(width + 50, bar.get_y() + bar.get_height()/2,
                    f"{width:,.2f} ({change:+.2f}%)",
                    ha='left', va='center', fontsize=10)

        plt.title("Harga Indeks Global Terbaru", fontsize=14, pad=20)
        plt.xlabel("Harga Penutupan", fontsize=12)
        plt.ylabel("Indeks", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "global_indices_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Indeks Global Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in global_indices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data indeks global")

@require_access(SubscriptionType.FREE)
@log_execution
async def commodity_prices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get commodity prices"""
    try:
        results = []

        for name, symbol in COMMODITIES.items():
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="5d")

                if not data.empty:
                    latest_close = data['Close'][-1]
                    if len(data) >= 2:
                        previous_close = data['Close'][-2]
                        change_percent = (latest_close - previous_close) / previous_close * 100
                        change_str = f"🟢 +{change_percent:+.2f}%" if change_percent > 0 else f"🔴 {change_percent:+.2f}%" if change_percent < 0 else "⚪ 0.00%"
                    else:
                        change_str = "⚪ N/A"

                    results.append(f"{name}: ${latest_close:,.2f} {change_str}")
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if results:
            message = "📈 *Harga Komoditas Terkini*\n\n" + "\n".join(results)
        else:
            message = "📈 *Harga Komoditas Terkini*\n\nMaaf, tidak ada data komoditas yang tersedia saat ini."

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in commodity_prices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil harga komoditas")

@require_access(SubscriptionType.FREE)
@log_execution
async def major_currencies(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get major currencies data"""
    try:
        currencies_data = []

        for name, symbol in MAJOR_CURRENCIES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    currencies_data.append({
                        "Currency": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if not currencies_data:
            await update.message.reply_text("Gagal mengambil data untuk semua pasangan mata uang.")
            return

        df = pd.DataFrame(currencies_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Currency'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            currency = df['Currency'].iloc[i]

            if currency in ["USD/IDR", "USD/INR", "USD/RUB"]:
                label = f"{width:,.2f} ({change:+.2f}%)"
            else:
                label = f"{width:.4f} ({change:+.2f}%)"

            plt.text(width + max(width * 0.05, 0.01), bar.get_y() + bar.get_height()/2,
                    label, ha='left', va='center', fontsize=10)

        plt.title("Harga Major Currencies Terbaru", fontsize=14, pad=20)
        plt.xlabel("Nilai Tukar", fontsize=12)
        plt.ylabel("Pasangan Mata Uang", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "major_currencies_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Major Currencies Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in major_currencies: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data mata uang")

@require_access(SubscriptionType.FREE)
@log_execution
async def watch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add to watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /watch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        from db_utils import add_to_watchlist
        await add_to_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} ditambahkan ke watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in watch: {str(e)}"))
        await show_error_message(update, context, "Gagal menambah ke watchlist")

@require_access(SubscriptionType.FREE)
@log_execution
async def unwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove from watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /unwatch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        from db_utils import remove_from_watchlist
        await remove_from_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} dihapus dari watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in unwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal menghapus dari watchlist")

@require_access(SubscriptionType.FREE)
@log_execution
async def listwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List watchlist"""
    try:
        user_id = update.effective_user.id
        from db_utils import get_watchlist
        watchlist = await get_watchlist(user_id)

        if not watchlist:
            await update.message.reply_text("Watchlist Anda kosong.")
            return

        message = "📋 *Daftar saham yang Anda pantau:*\n\n"
        for i, ticker in enumerate(watchlist, 1):
            message += f"{i}. {ticker}\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in listwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil watchlist")

# Placeholder functions for premium features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def technical_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Technical analysis (premium feature)"""
    await show_premium_required_message(update, context)

@require_access(SubscriptionType.PREMIUM)
@log_execution
async def predict_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Stock prediction (premium feature)"""
    await show_premium_required_message(update, context)

@require_access(SubscriptionType.PREMIUM)
@log_execution
async def fundamental(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fundamental analysis (premium feature)"""
    await show_premium_required_message(update, context)

@require_access(SubscriptionType.PREMIUM)
@log_execution
async def signal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trading signals (premium feature)"""
    await show_premium_required_message(update, context)

@require_access(SubscriptionType.PREMIUM)
@log_execution
async def volatility(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Volatility analysis (premium feature)"""
    await show_premium_required_message(update, context)

@require_access(SubscriptionType.PREMIUM)
@log_execution
async def value_investing_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Value investing analysis (premium feature)"""
    await show_premium_required_message(update, context)

# Export all functions
__all__ = [
    'check_stock', 'top_gainers', 'top_losers', 'top_crypto', 'global_indices',
    'commodity_prices', 'major_currencies', 'watch', 'unwatch', 'listwatch',
    'technical_analysis', 'predict_stock', 'fundamental', 'signal',
    'volatility', 'value_investing_analysis'
]

@require_access(SubscriptionType.FREE)
@log_execution
async def screen_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Screen stock data"""
    try:
        if not context.args:
            await update.message.reply_text(
                "Silakan masukkan kode saham, contoh: /s BJBR",
                parse_mode="Markdown"
            )
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Ticker, CompanyName, Close, Volume FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 30",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data untuk saham {ticker}.")
            return

        # Calculate changes
        df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Volume'])
        df['Change (%)'] = df['Close'].pct_change(-1) * 100
        df['Transaction'] = df['Close'] * df['Volume']

        message = f"Screening saham <b>{ticker}</b> ({df['CompanyName'].iloc[0]}):\n"

        for _, row in df.iterrows():
            change = row['Change (%)']
            if pd.isna(change):
                change_str = "N/A"
            else:
                change_str = f"{change".2f"}%"
                change_str = f"🟢 {change_str}" if change > 0 else f"🔴 {change_str}" if change < 0 else change_str

            transaction = row['Transaction']
            if pd.isna(transaction):
                trans_str = "N/A"
            else:
                if transaction >= 1_000_000_000:
                    trans_str = f"{transaction / 1_000_000_000".2f"} Miliar"
                else:
                    trans_str = f"{transaction / 1_000_000".2f"} Juta"

            message += (
                f"T: {row['Date']}, "
                f"H: {row['Close']".2f"}, "
                f"V: {row['Volume']}, "
                f"P: {change_str}, "
                f"N: {trans_str}\n"
            )

        await update.message.reply_text(message, parse_mode="HTML")

    except Exception as e:
        logger.error(safe_log(f"Error in screen_stock: {str(e)}"))
        await show_error_message(update, context, "Gagal melakukan screening saham")

@require_access(SubscriptionType.FREE)
@log_execution
async def percentage_change(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Calculate percentage change for stock"""
    try:
        if len(context.args) < 2:
            await update.message.reply_text(
                "Silakan masukkan ticker saham dan periode, contoh:\n"
                "- Dengan jumlah hari: /p BJBR 10\n"
                "- Dengan tanggal awal dan akhir (YYYY-MM-DD): /p BJBR 2025-02-01 2025-03-01\n"
                "Gunakan --advanced untuk analisis lanjutan, contoh: /p BJBR 2025-02-01 2025-03-01 --advanced",
                parse_mode="Markdown"
            )
            return

        ticker = context.args[0].upper()
        advanced_analysis = "--advanced" in context.args or "-a" in context.args

        # Parse arguments
        use_date_range = False
        start_date = None
        end_date = None
        days = None

        try:
            days = int(context.args[1])
            if days < 2:
                raise ValueError("Periode harus minimal 2 hari.")
        except ValueError:
            if len(context.args) < 3:
                await update.message.reply_text(
                    "Jika menggunakan tanggal, masukkan tanggal awal dan akhir, contoh: /p BJBR 2025-02-01 2025-03-01",
                    parse_mode="Markdown"
                )
                return

            try:
                start_date = context.args[1]
                end_date = context.args[2]

                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                if end_dt <= start_dt:
                    raise ValueError("Tanggal akhir harus lebih baru dari tanggal awal.")

                days = (end_dt - start_dt).days + 1
                use_date_range = True
            except ValueError as e:
                await update.message.reply_text(
                    "Format tanggal tidak valid. Gunakan format YYYY-MM-DD, contoh: /p BJBR 2025-02-01 2025-03-01",
                    parse_mode="Markdown"
                )
                return

        async with get_db_connection() as conn:
            if not use_date_range:
                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(
                        f"Data tidak cukup untuk analisis. Hanya tersedia {len(dates)} hari, diperlukan minimal {days} hari.",
                        parse_mode="Markdown"
                    )
                    return

                start_date, end_date = dates[-1], dates[0]

            cursor = await conn.execute(
                "SELECT Date, Close, Volume FROM stocks WHERE Date >= ? AND Date <= ? AND Ticker = ? AND Close IS NOT NULL AND Volume IS NOT NULL ORDER BY Date ASC",
                (start_date, end_date, ticker)
            )
            rows = await cursor.fetchall()

        if len(rows) < 2:
            await update.message.reply_text(
                f"Tidak ada data yang cukup untuk {ticker} pada tanggal yang dipilih. Hanya tersedia {len(rows)} hari, diperlukan minimal 2 hari.",
                parse_mode="Markdown"
            )
            return

        df = pd.DataFrame(rows, columns=['Date', 'Close', 'Volume'])
        start_price = df['Close'].iloc[0]
        end_price = df['Close'].iloc[-1]
        change = ((end_price - start_price) / start_price) * 100

        # Volume analysis
        start_volume = df['Volume'].iloc[0]
        end_volume = df['Volume'].iloc[-1]
        volume_change = end_volume - start_volume
        avg_volume = df['Volume'].mean()

        price_status = "Kenaikan" if change > 0 else "Penurunan" if change < 0 else "Stabil"
        volume_status = "Akumulasi" if volume_change > 0 else "Distribusi" if volume_change < 0 else "Stabil"

        # Advanced analysis
        prediction = ""
        if advanced_analysis:
            # Calculate ADL
            df['MFM'] = ((df['Close'] - df['Close'].shift(1)) - (df['Close'].shift(1) - df['Close'].shift(2))) / (df['Close'].shift(1) - df['Close'].shift(2))
            df['MFV'] = df['MFM'] * df['Volume']
            df['ADL'] = df['MFV'].cumsum()
            adl_change = (df['ADL'].iloc[-1] - df['ADL'].iloc[0]) / df['ADL'].iloc[0] * 100 if df['ADL'].iloc[0] != 0 else 0
            adl_status = "Akumulasi" if adl_change > 0 else "Distribusi" if adl_change < 0 else "Stabil"

            if adl_status == "Akumulasi" and price_status == "Kenaikan":
                prediction = "Jika tren akumulasi berlanjut, harga cenderung naik lebih lanjut."
            elif adl_status == "Distribusi" and price_status == "Penurunan":
                prediction = "Jika tren distribusi berlanjut, harga cenderung turun lebih lanjut."

        message = (
            f"📊 *Persentase Perubahan Harga Saham {ticker}*\n"
            f"⏳ Periode: {days} hari ({start_date} hingga {end_date})\n"
            f"📈 Harga Awal: {start_price".2f"}\n"
            f"📉 Harga Akhir: {end_price".2f"}\n"
            f"📊 Perubahan Harga: {change".2f"}% ({price_status})\n\n"
            f"📦 *Analisis Volume*\n"
            f"📏 Volume Awal: {start_volume","}\n"
            f"📏 Volume Akhir: {end_volume","}\n"
            f"📈 Selisih Volume: {volume_change","} ({volume_status})\n"
            f"📊 Rata-rata Volume: {avg_volume",.0f"}"
        )

        if advanced_analysis:
            message += f"\n\n📉 *Accumulation/Distribution Line (ADL)*\n📊 Perubahan ADL: {adl_change".2f"}% ({adl_status})"

        if prediction:
            message += f"\n\n🔮 *Prediksi Sederhana*\n{prediction}"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in percentage_change: {str(e)}"))
        await show_error_message(update, context, "Gagal menghitung persentase perubahan")

# Top Gainers/Losers Features
@require_access(SubscriptionType.FREE)
@log_execution
async def top_gainers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top gainers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df = df.dropna().nlargest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot = df_pivot.nlargest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📈 *Top Gainers ({period if is_date else period})*:\n\n"
        keyboard = []

        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                company_name = row['CompanyName']

            message += f"{ticker} ({company_name}): {change".2f"}%\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change".2f"}%", callback_data=f"tg_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_gainers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top gainers")

@require_access(SubscriptionType.FREE)
@log_execution
async def top_losers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top losers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open, Volume FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL AND Volume IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open', 'Volume'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df['TransactionValue'] = df['Close'] * df['Volume']
                df = df.dropna().nsmallest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Volume FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL AND Volume IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Volume'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Volume'] = df.groupby('Ticker')['Volume'].last()
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot['TransactionValue'] = df_pivot[end_date] * df_pivot['Volume']
                df_pivot = df_pivot.dropna().nsmallest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📉 *Top Losers ({period if is_date else period})*:\n\n"
        message += f"| Ticker      | Company Name         | Change (%) | Close     | Value (Rp)  |\n"
        message += f"|-------------|----------------------|------------|-----------|-------------|\n"

        keyboard = []
        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                close = row['Close']
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                close = row[end_date]
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']

            # Format transaction value
            if trans_value >= 1_000_000_000_000:
                trans_str = f"{trans_value / 1_000_000_000_000".2f"} T"
            elif trans_value >= 1_000_000_000:
                trans_str = f"{trans_value / 1_000_000_000".2f"} B"
            elif trans_value >= 1_000_000:
                trans_str = f"{trans_value / 1_000_000".2f"} M"
            else:
                trans_str = f"{trans_value",.2f"}"

            message += f"| {ticker"<11"} | {company_name[:18]"<20"} | {change">10.2f"}% | {close">9,.2f"} | {trans_str">11"} |\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change".2f"}%", callback_data=f"tl_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_losers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top losers")

# Index-specific top gainers/losers
@require_access(SubscriptionType.FREE)
@log_execution
async def top_gainers_lq45(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top gainers for LQ45"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        async with get_db_connection() as conn:
            if period == "harian":
                days = 2
            elif period == "mingguan":
                days = 5
            else:
                try:
                    days = int(period)
                    if days < 2:
                        raise ValueError
                except ValueError:
                    await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                    return

            cursor = await conn.execute(
                "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                (days,)
            )
            dates = [row[0] for row in await cursor.fetchall()]

            if len(dates) < days:
                await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                return

            start_date, end_date = dates[-1], dates[0]
            tickers = list(LQ45_STOCKS.keys())

            placeholders = ','.join(['?'] * len(tickers))
            cursor = await conn.execute(
                f"SELECT Date, Ticker, CompanyName, Close FROM stocks WHERE Date IN (?, ?) AND Ticker IN ({placeholders}) AND Close IS NOT NULL",
                [start_date, end_date] + tickers
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data saham LQ45 untuk periode {period}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close'])
        df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
        df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
        df_pivot = df_pivot.nlargest(45, 'Change')

        message = f"📈 *Top Gainers LQ45 ({period})*:\n\n"
        keyboard = []

        for ticker, row in df_pivot.iterrows():
            message += f"{ticker} ({row['CompanyName']}): {row['Change']".2f"}%\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {row['Change']".2f"}%", callback_data=f"tg45_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_gainers_lq45: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top gainers LQ45")

@require_access(SubscriptionType.FREE)
@log_execution
async def top_losers_lq45(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top losers for LQ45"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        async with get_db_connection() as conn:
            if period == "harian":
                days = 2
            elif period == "mingguan":
                days = 5
            else:
                try:
                    days = int(period)
                    if days < 2:
                        raise ValueError
                except ValueError:
                    await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                    return

            cursor = await conn.execute(
                "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                (days,)
            )
            dates = [row[0] for row in await cursor.fetchall()]

            if len(dates) < days:
                await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                return

            start_date, end_date = dates[-1], dates[0]
            tickers = list(LQ45_STOCKS.keys())

            placeholders = ','.join(['?'] * len(tickers))
            cursor = await conn.execute(
                f"SELECT Date, Ticker, CompanyName, Close FROM stocks WHERE Date IN (?, ?) AND Ticker IN ({placeholders}) AND Close IS NOT NULL",
                [start_date, end_date] + tickers
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data saham LQ45 untuk periode {period}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close'])
        df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
        df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
        df_pivot = df_pivot.nsmallest(10, 'Change')

        message = f"📉 *Top Losers LQ45 ({period})*:\n\n"
        keyboard = []

        for ticker, row in df_pivot.iterrows():
            message += f"{ticker} ({row['CompanyName']}): {row['Change']".2f"}%\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {row['Change']".2f"}%", callback_data=f"tl45_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_losers_lq45: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top losers LQ45")

# Chart and Visualization Features
@require_access(SubscriptionType.FREE)
@log_execution
async def chart_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Create stock chart"""
    try:
        if not context.args:
            await update.message.reply_text("Silakan masukkan kode saham, contoh: /ch BJBR")
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Open, High, Low, Close, Volume FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 30",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data untuk saham {ticker}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Open', 'High', 'Low', 'Close', 'Volume'])
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.set_index('Date').sort_index()

        # Calculate Fibonacci levels
        high_price = df['High'].max()
        low_price = df['Low'].min()
        diff = high_price - low_price
        fib_levels = {
            '0.0%': high_price,
            '23.6%': high_price - (diff * 0.236),
            '38.2%': high_price - (diff * 0.382),
            '50.0%': high_price - (diff * 0.50),
            '61.8%': high_price - (diff * 0.618),
            '100.0%': low_price
        }

        # Create chart
        import mplfinance as mpf

        fig, ax = mpf.plot(
            df,
            type='candle',
            style='charles',
            title=f'Candlestick Chart {ticker} with Fibonacci Retracement',
            ylabel='Harga',
            ylabel_lower='Volume',
            volume=True,
            figsize=(12, 8),
            returnfig=True,
            mav=(5, 20),
            panel_ratios=(3, 1),
            fill_between=dict(y1=fib_levels['0.0%'], y2=fib_levels['100.0%'], alpha=0.1, color='gray')
        )

        # Add Fibonacci lines
        for level, price in fib_levels.items():
            ax[0].axhline(y=price, color='purple', linestyle='--', linewidth=1, label=f'Fib {level}')

        ax[0].legend()

        chart_path = f"candlestick_{ticker}.png"
        fig.savefig(chart_path)
        plt.close(fig)

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Berikut adalah grafik candlestick dengan level Fibonacci Retracement:")
            await update.message.reply_photo(photo=photo)

        # Send Fibonacci levels
        fib_message = f"Level Fibonacci Retracement untuk {ticker}:\n"
        for level, price in fib_levels.items():
            fib_message += f"{level}: {price".2f"}\n"
        await update.message.reply_text(fib_message)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in chart_stock: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart saham")

# Technical Analysis Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def technical_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Perform technical analysis"""
    try:
        if not context.args:
            await update.message.reply_text("Silakan masukkan kode saham, contoh: /at BJBR")
            return

        ticker = context.args[0].upper()

        # Validate ticker
        valid_tickers = set()
        for index_stocks in INDEX_STOCKS.values():
            valid_tickers.update(index_stocks.keys())

        if ticker not in valid_tickers:
            await update.message.reply_text(f"Ticker {ticker} tidak dikenali. Gunakan kode saham yang valid.")
            return

        # Create technical analysis submenu
        keyboard = [
            [InlineKeyboardButton("MA5", callback_data=f"ma5_{ticker}"),
             InlineKeyboardButton("MA20", callback_data=f"ma20_{ticker}")],
            [InlineKeyboardButton("MA50", callback_data=f"ma50_{ticker}"),
             InlineKeyboardButton("MA100", callback_data=f"ma100_{ticker}")],
            [InlineKeyboardButton("MA200", callback_data=f"ma200_{ticker}"),
             InlineKeyboardButton("PSAR", callback_data=f"psar_{ticker}")],
            [InlineKeyboardButton("Ichimoku", callback_data=f"ichimoku_{ticker}"),
             InlineKeyboardButton("RSI", callback_data=f"rsi_{ticker}")],
            [InlineKeyboardButton("Stochastic", callback_data=f"stochastic_{ticker}"),
             InlineKeyboardButton("MACD", callback_data=f"macd_{ticker}")],
            [InlineKeyboardButton("Williams %R", callback_data=f"willr_{ticker}"),
             InlineKeyboardButton("OBV", callback_data=f"obv_{ticker}")],
            [InlineKeyboardButton("VWAP", callback_data=f"vwap_{ticker}"),
             InlineKeyboardButton("CMF", callback_data=f"cmf_{ticker}")],
            [InlineKeyboardButton("ATR", callback_data=f"atr_{ticker}"),
             InlineKeyboardButton("StdDev", callback_data=f"stddev_{ticker}")],
            [InlineKeyboardButton("Bollinger Bands", callback_data=f"bollinger_{ticker}")],
            [InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        company_name = ""
        for index_stocks in INDEX_STOCKS.values():
            if ticker in index_stocks:
                company_name = index_stocks[ticker]
                break

        await update.message.reply_text(
            f"Pilih indikator teknikal untuk {ticker} - {company_name}:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

    except Exception as e:
        logger.error(safe_log(f"Error in technical_analysis: {str(e)}"))
        await show_error_message(update, context, "Gagal menampilkan analisis teknikal")

# Prediction Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def predict_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Predict stock prices using multiple models"""
    try:
        if not context.args:
            await update.message.reply_text("Silakan masukkan kode saham, contoh: /predict BJBR [arima] [xgboost]")
            return

        ticker = context.args[0].upper()
        use_arima = "arima" in [arg.lower() for arg in context.args]
        use_xgboost = "xgboost" in [arg.lower() for arg in context.args]

        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Close, High, Low, Volume FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 200",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data teknikal untuk saham {ticker}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Close', 'High', 'Low', 'Volume'])
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date').set_index('Date')

        latest_date = df.index[-1]
        latest_close = df['Close'].iloc[-1]

        # Linear Regression
        df['Day'] = np.arange(len(df))
        X = df[['Day']].values
        y = df['Close'].values
        lin_reg = LinearRegression()
        lin_reg.fit(X, y)
        future_days = np.array([[len(df) + i] for i in range(1, 6)])
        lin_reg_pred = lin_reg.predict(future_days)

        # ARIMA if requested
        arima_forecast = None
        if use_arima and PMDARIMA_AVAILABLE:
            try:
                arima_model = auto_arima(df['Close'], order=(5, 1, 0))
                arima_result = arima_model.fit(df['Close'])
                arima_forecast = arima_result.forecast(steps=5)
            except Exception as e:
                logger.error(safe_log(f"ARIMA prediction failed: {str(e)}"))

        # XGBoost if requested
        xgb_pred = None
        if use_xgboost and XGBOOST_AVAILABLE:
            try:
                df['Lag1'] = df['Close'].shift(1)
                df['Lag2'] = df['Close'].shift(2)
                df['EMA12'] = df['Close'].ewm(span=12).mean()
                df.dropna(inplace=True)

                X = df[['Lag1', 'Lag2', 'EMA12', 'Volume', 'High', 'Low']]
                y = df['Close']

                xgb_model = XGBRegressor(n_estimators=100)
                xgb_model.fit(X, y)

                future_inputs = []
                last_row = df.iloc[-1]
                for i in range(5):
                    new_input = [last_row['Close'], last_row['Lag1'], last_row['EMA12'], last_row['Volume'], last_row['High'], last_row['Low']]
                    pred = xgb_model.predict([new_input])[0]
                    future_inputs.append(pred)
                    last_row = pd.Series({
                        'Close': pred,
                        'Lag1': last_row['Close'],
                        'Lag2': last_row['Lag1'],
                        'EMA12': (last_row['EMA12'] * 11 + pred) / 12,
                        'Volume': last_row['Volume'],
                        'High': pred * 1.01,
                        'Low': pred * 0.99
                    })

                xgb_pred = future_inputs
            except Exception as e:
                logger.error(safe_log(f"XGBoost prediction failed: {str(e)}"))

        # Create response
        message = f"📊 *Prediksi Harga Saham {ticker}*\n\n"
        message += f"Harga Penutupan Terbaru: {latest_close".2f"}\n\n"

        # Linear Regression
        message += "1. Linear Regression:\n"
        for i, pred in enumerate(lin_reg_pred, 1):
            pred_date = latest_date + timedelta(days=i)
            message += f"  {pred_date.strftime('%Y-%m-%d')}: {pred".2f"}\n"

        # ARIMA
        if arima_forecast is not None:
            message += "\n2. ARIMA Prediction:\n"
            for i, pred in enumerate(arima_forecast, 1):
                pred_date = latest_date + timedelta(days=i)
                message += f"  {pred_date.strftime('%Y-%m-%d')}: {pred".2f"}\n"

        # XGBoost
        if xgb_pred is not None:
            message += "\n3. XGBoost Prediction:\n"
            for i, pred in enumerate(xgb_pred, 1):
                pred_date = latest_date + timedelta(days=i)
                message += f"  {pred_date.strftime('%Y-%m-%d')}: {pred".2f"}\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in predict_stock: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat prediksi saham")

# Fundamental Analysis Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def fundamental(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get fundamental analysis"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /af ESSA")
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT * FROM fundamental_data WHERE Ticker = ?",
                (ticker,)
            )
            row = await cursor.fetchone()

        if not row:
            await update.message.reply_text(f"Tidak ada data fundamental untuk saham {ticker}. Silakan perbarui data dengan /update_fundamental.")
            return

        columns = [desc[0] for desc in cursor.description]
        data = dict(zip(columns, row))

        # Get current price
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Close FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 1",
                (ticker,)
            )
            price_row = await cursor.fetchone()

        current_price = price_row[0] if price_row else "N/A"

        message = f"📊 *Analisis Fundamental {ticker} - {data['CompanyName']}*\n\n"
        message += f"**Harga Saat Ini:** Rp{current_price}\n\n"
        message += "**Fundamental:**\n"
        message += f"📈 P/E Ratio: {data['PE_Ratio']".2f"}x\n"
        message += f"💰 Market Cap: Rp{data['Market_Cap']","}\n"
        message += f"📊 EPS: Rp{data['EPS']".2f"}\n"
        message += f"📉 ROE: {data['ROE']".2f"}%\n"
        message += f"⚖️ Debt to Equity: {data['Debt_to_Equity']".2f"}\n"
        message += f"💸 Dividend Yield: {data['Dividend_Yield']".2f"}%\n"
        message += f"🌐 Sumber: Database Yahoo Finance\n"
        message += f"🔗 Website: https://www.idnfinancials.com/id/{ticker}\n\n"

        if data['Debt_to_Equity'] > 0.5:
            message += "⚠️ **Hati-hati:** Debt to Equity > 0.5, pertimbangkan dengan hati-hati.\n\n"

        await update.message.reply_text(message, parse_mode="Markdown", disable_web_page_preview=True)

    except Exception as e:
        logger.error(safe_log(f"Error in fundamental: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil analisis fundamental")

# Crypto Features
@require_access(SubscriptionType.FREE)
@log_execution
async def top_crypto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top crypto data"""
    try:
        async with get_db_connection(DB_NAME) as conn:
            cursor = await conn.execute(
                "SELECT MAX(timestamp) FROM metadata"
            )
            latest_timestamp = await cursor.fetchone()

            if not latest_timestamp:
                await update.message.reply_text("Data cryptocurrency tidak ditemukan. Memperbarui data sekarang...")
                await update_crypto_data(context)
                return

            timestamp = latest_timestamp[0]
            cursor = await conn.execute(
                "SELECT symbol, name, price_usd, market_cap, percent_change_24h FROM coins WHERE timestamp = ? ORDER BY market_cap DESC LIMIT 10",
                (timestamp,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text("Tidak ada data cryptocurrency yang tersedia saat ini.")
            return

        message = "💰 *Top 10 Cryptocurrencies by Market Cap*:\n\n"
        for row in rows:
            symbol, name, price, market_cap, change = row
            message += f"{name} ({symbol})\nHarga: ${price",.2f"}\nMarket Cap: ${market_cap",.0f"}\nPerubahan 24h: {change"+.2f"}%\n\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_crypto: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data crypto")

# Global Market Features
@require_access(SubscriptionType.FREE)
@log_execution
async def global_indices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get global indices data"""
    try:
        indices_data = []

        for name, symbol in GLOBAL_INDICES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    indices_data.append({
                        "Index": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if len(indices_data) < 3:
            await update.message.reply_text("Data indeks global tidak cukup. Silakan coba lagi nanti.")
            return

        df = pd.DataFrame(indices_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Index'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            plt.text(width + 50, bar.get_y() + bar.get_height()/2,
                    f"{width",.2f"} ({change"+.2f"}%)",
                    ha='left', va='center', fontsize=10)

        plt.title("Harga Indeks Global Terbaru", fontsize=14, pad=20)
        plt.xlabel("Harga Penutupan", fontsize=12)
        plt.ylabel("Indeks", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "global_indices_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Indeks Global Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in global_indices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data indeks global")

# Commodity Features
@require_access(SubscriptionType.FREE)
@log_execution
async def commodity_prices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get commodity prices"""
    try:
        results = []

        for name, symbol in COMMODITIES.items():
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="5d")

                if not data.empty:
                    latest_close = data['Close'][-1]
                    if len(data) >= 2:
                        previous_close = data['Close'][-2]
                        change_percent = (latest_close - previous_close) / previous_close * 100
                        change_str = f"🟢 +{change_percent"+.2f"}%" if change_percent > 0 else f"🔴 {change_percent"+.2f"}%" if change_percent < 0 else "⚪ 0.00%"
                    else:
                        change_str = "⚪ N/A"

                    results.append(f"{name}: ${latest_close",.2f"} {change_str}")
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if results:
            message = "📈 *Harga Komoditas Terkini*\n\n" + "\n".join(results)
        else:
            message = "📈 *Harga Komoditas Terkini*\n\nMaaf, tidak ada data komoditas yang tersedia saat ini."

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in commodity_prices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil harga komoditas")

# Currency Features
@require_access(SubscriptionType.FREE)
@log_execution
async def major_currencies(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get major currencies data"""
    try:
        currencies_data = []

        for name, symbol in MAJOR_CURRENCIES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    currencies_data.append({
                        "Currency": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if not currencies_data:
            await update.message.reply_text("Gagal mengambil data untuk semua pasangan mata uang.")
            return

        df = pd.DataFrame(currencies_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Currency'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            currency = df['Currency'].iloc[i]

            if currency in ["USD/IDR", "USD/INR", "USD/RUB"]:
                label = f"{width",.2f"} ({change"+.2f"}%)"
            else:
                label = f"{width".4f"} ({change"+.2f"}%)"

            plt.text(width + max(width * 0.05, 0.01), bar.get_y() + bar.get_height()/2,
                    label, ha='left', va='center', fontsize=10)

        plt.title("Harga Major Currencies Terbaru", fontsize=14, pad=20)
        plt.xlabel("Nilai Tukar", fontsize=12)
        plt.ylabel("Pasangan Mata Uang", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "major_currencies_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Major Currencies Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in major_currencies: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data mata uang")

# News Features
@require_access(SubscriptionType.FREE)
@log_execution
async def news(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get news for a stock"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /news ESSA")
            return

        ticker = context.args[0].upper()
        company_name = ""
        for index_stocks in INDEX_STOCKS.values():
            if ticker in index_stocks:
                company_name = index_stocks[ticker]
                break

        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT title, url, published_date, source FROM news WHERE ticker = ? ORDER BY published_date DESC",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada berita terkait untuk {ticker} saat ini.")
            return

        message = f"📰 *Berita Terkait {ticker} - {company_name}:*\n\n"
        for title, url, published_date, source in rows[:3]:
            message += f"**{title}**\n"
            message += f"Sumber: {source}\n"
            message += f"Terbit: {published_date}\n"
            message += f"Link: {url}\n\n"

        await update.message.reply_text(message, parse_mode="Markdown", disable_web_page_preview=True)

    except Exception as e:
        logger.error(safe_log(f"Error in news: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil berita")

# Watchlist Features
@require_access(SubscriptionType.FREE)
@log_execution
async def watch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add to watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /watch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        await add_to_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} ditambahkan ke watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in watch: {str(e)}"))
        await show_error_message(update, context, "Gagal menambah ke watchlist")

@require_access(SubscriptionType.FREE)
@log_execution
async def unwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove from watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /unwatch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        await remove_from_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} dihapus dari watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in unwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal menghapus dari watchlist")

@require_access(SubscriptionType.FREE)
@log_execution
async def listwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List watchlist"""
    try:
        user_id = update.effective_user.id
        watchlist = await get_watchlist(user_id)

        if not watchlist:
            await update.message.reply_text("Watchlist Anda kosong.")
            return

        message = "📋 *Daftar saham yang Anda pantau:*\n\n"
        for i, ticker in enumerate(watchlist, 1):
            message += f"{i}. {ticker}\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in listwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil watchlist")

# Signal Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def signal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get trading signals"""
    try:
        if not context.args:
            await update.message.reply_text("Silakan masukkan kode saham, contoh: /signal BJBR")
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Close, High, Low FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 50",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data untuk saham {ticker}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Close', 'High', 'Low'])
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date')

        # Calculate indicators
        if TA_AVAILABLE:
            df['RSI'] = rsi(df['Close'], length=14)
            macd_data = macd(df['Close'])
            df['MACD'] = macd_data['MACD_12_26_9']
            df['Signal'] = macd_data['MACDs_12_26_9']
            stoch_data = stochastic(df['High'], df['Low'], df['Close'])
            df['Stoch_K'] = stoch_data['STOCHk_14_3_3']

            # Get latest values
            rsi = df['RSI'].iloc[-1]
            macd_line = df['MACD'].iloc[-1]
            signal_line = df['Signal'].iloc[-1]
            stoch_k = df['Stoch_K'].iloc[-1]

            # Generate signals
            buy_signals = 0
            sell_signals = 0

            if rsi < 30:
                buy_signals += 1
            elif rsi > 70:
                sell_signals += 1

            if macd_line > signal_line:
                buy_signals += 1
            elif macd_line < signal_line:
                sell_signals += 1

            if stoch_k < 20:
                buy_signals += 1
            elif stoch_k > 80:
                sell_signals += 1

            if buy_signals >= 2:
                recommendation = "Beli (Potensi Kenaikan)"
            elif sell_signals >= 2:
                recommendation = "Jual (Potensi Penurunan)"
            else:
                recommendation = "Tahan (Netral)"

            message = f"Sinyal Trading {ticker}:\n"
            message += f"RSI: {rsi".2f"}\n"
            message += f"MACD: Line: {macd_line".2f"}, Signal: {signal_line".2f"}\n"
            message += f"Stochastic %K: {stoch_k".2f"}\n"
            message += f"Rekomendasi: {recommendation}\n"
            message += f"Tanggal: {df['Date'].iloc[-1].strftime('%Y-%m-%d')}"
        else:
            message = "Sinyal trading tidak tersedia. Library TA tidak terinstall."

        await update.message.reply_text(message)

    except Exception as e:
        logger.error(safe_log(f"Error in signal: {str(e)}"))
        await show_error_message(update, context, "Gagal menghitung sinyal trading")

# Volatility Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def volatility(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Calculate volatility"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /volatility BJBR")
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Close FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 30",
                (ticker,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text(f"Tidak ada data untuk saham {ticker}.")
            return

        df = pd.DataFrame(rows, columns=['Date', 'Close'])
        df['Returns'] = df['Close'].pct_change()
        volatility = df['Returns'].std() * np.sqrt(252)  # Annualized

        # Market volatility
        cursor = await conn.execute(
            "SELECT AVG(Close) as AvgClose FROM stocks GROUP BY Date ORDER BY Date DESC LIMIT 30"
        )
        market_rows = await cursor.fetchall()

        if market_rows:
            market_df = pd.DataFrame(market_rows, columns=['AvgClose'])
            market_df['Returns'] = market_df['AvgClose'].pct_change()
            market_vol = market_df['Returns'].std() * np.sqrt(252)

            message = f"Analisis Volatilitas {ticker}:\n"
            message += f"Volatilitas (30 Hari, Annualized): {volatility".2%"}"
            message += f"Rata-rata Volatilitas Pasar: {market_vol".2%"}"
            message += f"Status: {'Tinggi' if volatility > market_vol else 'Rendah'} dibandingkan pasar"
        else:
            message = f"Volatilitas {ticker} (30 Hari, Annualized): {volatility".2%"}"

        await update.message.reply_text(message)

    except Exception as e:
        logger.error(safe_log(f"Error in volatility: {str(e)}"))
        await show_error_message(update, context, "Gagal menghitung volatilitas")

# Broker Activity Features
@require_access(SubscriptionType.FREE)
@log_execution
async def broker_activity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get broker activity"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Broker, BuyVolume, SellVolume FROM broker_summary ORDER BY Date DESC LIMIT 10"
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text("Tidak ada data aktivitas broker.")
            return

        message = "Aktivitas Broker:\n"
        for date, broker, buy_volume, sell_volume in rows:
            total_volume = buy_volume + sell_volume
            message += f"Tanggal: {date}, Broker: {broker}, Buy Volume: {buy_volume}, Sell Volume: {sell_volume}, Total Volume: {total_volume}\n"

        await update.message.reply_text(message)

    except Exception as e:
        logger.error(safe_log(f"Error in broker_activity: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil aktivitas broker")

# Value Investing Features
@require_access(SubscriptionType.PREMIUM)
@log_execution
async def value_investing_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Perform value investing analysis"""
    try:
        specific_ticker = context.args[0].upper() if context.args else None

        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT ticker, name, sector, pe_ratio, pb_ratio, dividend_yield, market_cap, eps, roe, debt_to_equity FROM fundamental_data WHERE pe_ratio IS NOT NULL AND pb_ratio IS NOT NULL AND dividend_yield IS NOT NULL AND roe IS NOT NULL AND debt_to_equity IS NOT NULL"
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text("Tidak ada data fundamental yang tersedia untuk analisis value investing.")
            return

        df = pd.DataFrame(rows, columns=['ticker', 'name', 'sector', 'pe_ratio', 'pb_ratio', 'dividend_yield', 'market_cap', 'eps', 'roe', 'debt_to_equity'])

        # Convert to numeric
        numeric_columns = ['pe_ratio', 'pb_ratio', 'dividend_yield', 'roe', 'debt_to_equity', 'market_cap', 'eps']
        for col in numeric_columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        df = df.dropna()

        if df.empty:
            await update.message.reply_text("Data fundamental tidak lengkap setelah pembersihan.")
            return

        # Calculate sector averages
        sector_pe_avg = df.groupby('sector')['pe_ratio'].mean()

        if specific_ticker:
            value_stocks = df[df['ticker'] == specific_ticker]
        else:
            # Filter value stocks
            value_stocks = df[
                (df['pe_ratio'] < df['sector'].map(sector_pe_avg)) &
                (df['pb_ratio'] < 1.5) &
                (df['dividend_yield'] > 0.02) &
                (df['roe'] > 0.10) &
                (df['debt_to_equity'] < 1.0)
            ].head(10)

        if value_stocks.empty:
            await update.message.reply_text("Tidak ada saham yang memenuhi kriteria value investing saat ini." if not specific_ticker else f"Saham {specific_ticker} tidak memenuhi kriteria value investing.")
            return

        # Store in context for submenu
        context.user_data['value_stocks'] = value_stocks

        message = f"📈 *{'Analisis Value Investing untuk ' + specific_ticker if specific_ticker else 'Hasil Analisis Value Investing'}*\n\n"
        for _, row in value_stocks.iterrows():
            message += f"🏦 **{row['ticker']} - {row['name']}**\n"
            message += f"📊 Harga Pasar: Rp{row['market_cap']/1000000".2f"}M\n"
            message += f"📈 P/E Ratio: {row['pe_ratio']".2f"}\n"
            message += f"📊 P/B Ratio: {row['pb_ratio']".2f"}\n"
            message += f"💸 Dividend Yield: {row['dividend_yield']*100".2f"}%\n"
            message += f"📈 ROE: {row['roe']*100".2f"}%\n"
            message += f"⚖️ Debt-to-Equity: {row['debt_to_equity']".2f"}\n\n"

        keyboard = [
            [InlineKeyboardButton(ticker, callback_data=f"value_{ticker}")]
            for ticker in value_stocks['ticker']
        ]
        keyboard.append([InlineKeyboardButton("🔙 Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in value_investing_analysis: {str(e)}"))
        await show_error_message(update, context, "Gagal melakukan analisis value investing")

# Export all functions
__all__ = [
    'check_stock', 'screen_stock', 'percentage_change', 'top_gainers', 'top_losers',
    'top_gainers_lq45', 'top_losers_lq45', 'chart_stock', 'technical_analysis',
    'predict_stock', 'fundamental', 'top_crypto', 'global_indices',
    'commodity_prices', 'major_currencies', 'news', 'watch', 'unwatch',
    'listwatch', 'signal', 'volatility', 'broker_activity', 'value_investing_analysis'
]