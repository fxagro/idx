"""
Database utilities for BJB Sekuritas Telegram Bot
Async database operations using aiosqlite
"""

import aiosqlite
import asyncio
import logging
import json
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from contextlib import asynccontextmanager

from config import (
    DATABASE_PATH, DB_NAME, CMC_DATA_DB, Bjb_DB,
    DEFAULT_BALANCE, ADMIN_IDS, LOG_CONFIG
)
from enums import SubscriptionType, TransactionStatus, ErrorType

# Setup logging
logger = logging.getLogger(__name__)

# Global database connections
db_connections = {}
file_lock = threading.Lock()

class DatabaseManager:
    """Async database manager for handling connections and operations"""

    def __init__(self):
        self._connections = {}
        self._lock = asyncio.Lock()

    async def get_connection(self, db_path: str = DATABASE_PATH) -> aiosqlite.Connection:
        """Get or create database connection"""
        if db_path not in self._connections:
            self._connections[db_path] = await aiosqlite.connect(db_path)
        return self._connections[db_path]

    async def close_all(self):
        """Close all database connections"""
        for conn in self._connections.values():
            await conn.close()
        self._connections.clear()

# Global database manager instance
db_manager = DatabaseManager()

@asynccontextmanager
async def get_db_connection(db_path: str = DATABASE_PATH):
    """Context manager for database connections"""
    conn = await db_manager.get_connection(db_path)
    try:
        yield conn
    finally:
        pass  # Connection is reused, don't close it here

async def init_databases():
    """Initialize all required databases"""
    try:
        # Initialize main stock database
        await init_stock_database()

        # Initialize crypto database
        await init_crypto_database()

        # Initialize BJB database
        await init_bjb_database()

        logger.info("All databases initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing databases: {str(e)}")
        raise

async def init_stock_database():
    """Initialize stock database with required tables"""
    async with get_db_connection() as conn:
        # Users table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                access_count INTEGER DEFAULT 0,
                last_access_date TEXT,
                subscription_type TEXT DEFAULT 'free',
                subscription_expiry TEXT
            )
        ''')

        # Stocks table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS stocks (
                Date TEXT,
                Ticker TEXT,
                CompanyName TEXT,
                Open REAL,
                High REAL,
                Low REAL,
                Close REAL,
                Volume INTEGER,
                PRIMARY KEY (Date, Ticker)
            )
        ''')

        # Fundamental data table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS fundamental_data (
                Ticker TEXT PRIMARY KEY,
                CompanyName TEXT,
                EPS REAL,
                PE_Ratio REAL,
                PBV REAL,
                ROE REAL,
                Debt_to_Equity REAL,
                Market_Cap REAL,
                Last_Updated TEXT
            )
        ''')

        # Watchlist table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS watchlist (
                user_id INTEGER,
                ticker TEXT,
                PRIMARY KEY (user_id, ticker)
            )
        ''')

        # Price alerts table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS price_alerts (
                user_id INTEGER,
                ticker TEXT,
                target_price REAL,
                alert_type TEXT,
                PRIMARY KEY (user_id, ticker, target_price, alert_type)
            )
        ''')

        # News table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS news (
                ticker TEXT,
                title TEXT,
                url TEXT,
                published_date TEXT,
                source TEXT,
                last_updated TEXT,
                PRIMARY KEY (ticker, title)
            )
        ''')

        # Feedback table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                user_id INTEGER,
                rating INTEGER,
                feedback TEXT,
                timestamp TEXT,
                PRIMARY KEY (user_id, timestamp)
            )
        ''')

        await conn.commit()
        logger.info("Stock database initialized")

async def init_crypto_database():
    """Initialize crypto database with required tables"""
    async with get_db_connection(DB_NAME) as conn:
        # Metadata table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS metadata (
                timestamp TEXT,
                total_coins INTEGER,
                coins_scanned INTEGER
            )
        ''')

        # Coins table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS coins (
                timestamp TEXT,
                symbol TEXT,
                name TEXT,
                price_usd REAL,
                volume_24h REAL,
                volume_change_24h REAL,
                percent_change_1h REAL,
                percent_change_24h REAL,
                percent_change_7d REAL,
                percent_change_30d REAL,
                percent_change_60d REAL,
                percent_change_90d REAL,
                market_cap REAL,
                market_cap_dominance REAL,
                fully_diluted_market_cap REAL,
                quote_last_updated TEXT,
                circulating_supply REAL,
                slug TEXT,
                cmc_rank INTEGER
            )
        ''')

        # Coin metadata table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS coin_metadata (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                slug TEXT,
                website TEXT,
                date_added TEXT
            )
        ''')

        await conn.commit()
        logger.info("Crypto database initialized")

async def init_bjb_database():
    """Initialize BJB database with required tables"""
    async with get_db_connection(Bjb_DB) as conn:
        # Goal setting table
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS goal_setting (
                keterangan TEXT,
                tahun_proyeksi REAL,
                target REAL,
                realisasi REAL,
                status TEXT,
                tanggal TEXT,
                PRIMARY KEY (keterangan, tanggal)
            )
        ''')

        await conn.commit()
        logger.info("BJB database initialized")

async def check_user_access(user_id: int) -> Tuple[bool, str]:
    """
    Check user access level and update access count
    Returns: (has_access: bool, reason: str)
    """
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        async with get_db_connection() as conn:
            # Get user data
            cursor = await conn.execute(
                "SELECT access_count, last_access_date, subscription_type, subscription_expiry FROM users WHERE user_id = ?",
                (user_id,)
            )
            user_data = await cursor.fetchone()

            if not user_data:
                # Create new user
                await conn.execute(
                    "INSERT INTO users (user_id, access_count, last_access_date, subscription_type) VALUES (?, 0, ?, 'free')",
                    (user_id, today)
                )
                await conn.commit()
                user_data = (0, today, 'free', None)

            access_count, last_access_date, subscription_type, subscription_expiry = user_data

            # Reset access count if it's a new day
            if last_access_date != today:
                await conn.execute(
                    "UPDATE users SET access_count = 0, last_access_date = ? WHERE user_id = ?",
                    (today, user_id)
                )
                access_count = 0

            # Check subscription
            if subscription_type != 'free':
                if subscription_type in ['monthly', 'yearly'] and subscription_expiry:
                    expiry_date = datetime.strptime(subscription_expiry, '%Y-%m-%d')
                    if expiry_date < datetime.now():
                        # Subscription expired
                        await conn.execute(
                            "UPDATE users SET subscription_type = 'free', subscription_expiry = NULL WHERE user_id = ?",
                            (user_id,)
                        )
                        subscription_type = 'free'

                if subscription_type in ['monthly', 'yearly', 'bjb_account']:
                    return True, "premium_access"

            # Check free access limit
            if access_count >= 3:
                return False, "access_limit_reached"

            # Increment access count
            await conn.execute(
                "UPDATE users SET access_count = access_count + 1 WHERE user_id = ?",
                (user_id,)
            )
            await conn.commit()

            return True, "free_access"

    except Exception as e:
        logger.error(f"Error checking user access for {user_id}: {str(e)}")
        return False, "database_error"

async def get_user_subscription(user_id: int) -> Tuple[SubscriptionType, Optional[str]]:
    """Get user subscription type and expiry"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT subscription_type, subscription_expiry FROM users WHERE user_id = ?",
                (user_id,)
            )
            user_data = await cursor.fetchone()

            if not user_data:
                return SubscriptionType.FREE, None

            sub_type, expiry = user_data
            return SubscriptionType(sub_type), expiry

    except Exception as e:
        logger.error(f"Error getting user subscription for {user_id}: {str(e)}")
        return SubscriptionType.FREE, None

async def update_user_subscription(user_id: int, sub_type: SubscriptionType, expiry: Optional[str] = None):
    """Update user subscription"""
    try:
        async with get_db_connection() as conn:
            await conn.execute(
                "UPDATE users SET subscription_type = ?, subscription_expiry = ? WHERE user_id = ?",
                (sub_type.value, expiry, user_id)
            )
            await conn.commit()
            logger.info(f"Updated subscription for user {user_id} to {sub_type.value}")

    except Exception as e:
        logger.error(f"Error updating subscription for {user_id}: {str(e)}")
        raise

async def add_to_watchlist(user_id: int, ticker: str):
    """Add ticker to user watchlist"""
    try:
        async with get_db_connection() as conn:
            await conn.execute(
                "INSERT OR IGNORE INTO watchlist (user_id, ticker) VALUES (?, ?)",
                (user_id, ticker.upper())
            )
            await conn.commit()
            logger.info(f"Added {ticker} to watchlist for user {user_id}")

    except Exception as e:
        logger.error(f"Error adding to watchlist for {user_id}: {str(e)}")
        raise

async def remove_from_watchlist(user_id: int, ticker: str):
    """Remove ticker from user watchlist"""
    try:
        async with get_db_connection() as conn:
            await conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
                (user_id, ticker.upper())
            )
            await conn.commit()
            logger.info(f"Removed {ticker} from watchlist for user {user_id}")

    except Exception as e:
        logger.error(f"Error removing from watchlist for {user_id}: {str(e)}")
        raise

async def get_watchlist(user_id: int) -> List[str]:
    """Get user watchlist"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT ticker FROM watchlist WHERE user_id = ?",
                (user_id,)
            )
            rows = await cursor.fetchall()
            return [row[0] for row in rows]

    except Exception as e:
        logger.error(f"Error getting watchlist for {user_id}: {str(e)}")
        return []

async def add_price_alert(user_id: int, ticker: str, target_price: float, alert_type: str):
    """Add price alert for user"""
    try:
        async with get_db_connection() as conn:
            await conn.execute(
                "INSERT OR REPLACE INTO price_alerts (user_id, ticker, target_price, alert_type) VALUES (?, ?, ?, ?)",
                (user_id, ticker.upper(), target_price, alert_type)
            )
            await conn.commit()
            logger.info(f"Added price alert for {ticker} at {target_price} ({alert_type}) for user {user_id}")

    except Exception as e:
        logger.error(f"Error adding price alert for {user_id}: {str(e)}")
        raise

async def get_price_alerts(user_id: int) -> List[Dict]:
    """Get user price alerts"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT ticker, target_price, alert_type FROM price_alerts WHERE user_id = ?",
                (user_id,)
            )
            rows = await cursor.fetchall()
            return [
                {
                    'ticker': row[0],
                    'target_price': row[1],
                    'alert_type': row[2]
                }
                for row in rows
            ]

    except Exception as e:
        logger.error(f"Error getting price alerts for {user_id}: {str(e)}")
        return []

async def remove_price_alert(user_id: int, ticker: str, target_price: float, alert_type: str):
    """Remove price alert"""
    try:
        async with get_db_connection() as conn:
            await conn.execute(
                "DELETE FROM price_alerts WHERE user_id = ? AND ticker = ? AND target_price = ? AND alert_type = ?",
                (user_id, ticker.upper(), target_price, alert_type)
            )
            await conn.commit()
            logger.info(f"Removed price alert for {ticker} at {target_price} ({alert_type}) for user {user_id}")

    except Exception as e:
        logger.error(f"Error removing price alert for {user_id}: {str(e)}")
        raise

async def check_price_alerts() -> List[Dict]:
    """Check all price alerts and return triggered ones"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT user_id, ticker, target_price, alert_type FROM price_alerts"
            )
            alerts = await cursor.fetchall()

            triggered = []
            for user_id, ticker, target_price, alert_type in alerts:
                # Get latest price
                price_cursor = await conn.execute(
                    "SELECT Close FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 1",
                    (ticker,)
                )
                price_data = await price_cursor.fetchone()

                if price_data:
                    current_price = price_data[0]
                    should_trigger = False

                    if alert_type == 'above' and current_price >= target_price:
                        should_trigger = True
                    elif alert_type == 'below' and current_price <= target_price:
                        should_trigger = True

                    if should_trigger:
                        triggered.append({
                            'user_id': user_id,
                            'ticker': ticker,
                            'target_price': target_price,
                            'alert_type': alert_type,
                            'current_price': current_price
                        })

            return triggered

    except Exception as e:
        logger.error(f"Error checking price alerts: {str(e)}")
        return []

async def add_feedback(user_id: int, rating: int, feedback: str):
    """Add user feedback"""
    try:
        async with get_db_connection() as conn:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            await conn.execute(
                "INSERT INTO feedback (user_id, rating, feedback, timestamp) VALUES (?, ?, ?, ?)",
                (user_id, rating, feedback, timestamp)
            )
            await conn.commit()
            logger.info(f"Added feedback for user {user_id}: rating={rating}")

    except Exception as e:
        logger.error(f"Error adding feedback for {user_id}: {str(e)}")
        raise

async def get_latest_crypto_data() -> List[Dict]:
    """Get latest crypto data"""
    try:
        async with get_db_connection(DB_NAME) as conn:
            cursor = await conn.execute(
                "SELECT timestamp FROM metadata ORDER BY timestamp DESC LIMIT 1"
            )
            latest_timestamp = await cursor.fetchone()

            if not latest_timestamp:
                return []

            timestamp = latest_timestamp[0]
            cursor = await conn.execute(
                "SELECT symbol, name, price_usd, market_cap, percent_change_24h FROM coins WHERE timestamp = ? ORDER BY market_cap DESC LIMIT 10",
                (timestamp,)
            )
            rows = await cursor.fetchall()

            return [
                {
                    'symbol': row[0],
                    'name': row[1],
                    'price': row[2],
                    'market_cap': row[3],
                    'change_24h': row[4]
                }
                for row in rows
            ]

    except Exception as e:
        logger.error(f"Error getting latest crypto data: {str(e)}")
        return []

async def save_crypto_data(coins_data: List[Dict], metadata: Dict):
    """Save crypto data to database"""
    try:
        async with get_db_connection(DB_NAME) as conn:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # Save metadata
            await conn.execute(
                "INSERT INTO metadata (timestamp, total_coins, coins_scanned) VALUES (?, ?, ?)",
                (timestamp, metadata['total_coins'], metadata['coins_scanned'])
            )

            # Save coins data
            for coin in coins_data:
                await conn.execute('''
                    INSERT INTO coins (
                        timestamp, symbol, name, price_usd, volume_24h, volume_change_24h,
                        percent_change_1h, percent_change_24h, percent_change_7d,
                        percent_change_30d, percent_change_60d, percent_change_90d,
                        market_cap, market_cap_dominance, fully_diluted_market_cap,
                        quote_last_updated, circulating_supply, slug, cmc_rank
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    timestamp, coin['symbol'], coin['name'], coin['price_usd'],
                    coin['volume_24h'], coin['volume_change_24h'], coin['percent_change_1h'],
                    coin['percent_change_24h'], coin['percent_change_7d'], coin['percent_change_30d'],
                    coin['percent_change_60d'], coin['percent_change_90d'], coin['market_cap'],
                    coin['market_cap_dominance'], coin['fully_diluted_market_cap'],
                    coin['quote_last_updated'], coin['circulating_supply'], coin['slug'],
                    coin['cmc_rank']
                ))

            await conn.commit()
            logger.info(f"Saved crypto data for {len(coins_data)} coins")

    except Exception as e:
        logger.error(f"Error saving crypto data: {str(e)}")
        raise

async def get_stock_data(ticker: str, limit: int = 30) -> List[Dict]:
    """Get stock data for a ticker"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, Close, Volume, High, Low FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT ?",
                (ticker.upper(), limit)
            )
            rows = await cursor.fetchall()

            return [
                {
                    'date': row[0],
                    'close': row[1],
                    'volume': row[2],
                    'high': row[3],
                    'low': row[4]
                }
                for row in rows
            ]

    except Exception as e:
        logger.error(f"Error getting stock data for {ticker}: {str(e)}")
        return []

async def save_stock_data(stocks_data: List[Dict]):
    """Save stock data to database"""
    try:
        async with get_db_connection() as conn:
            for stock in stocks_data:
                await conn.execute('''
                    INSERT OR REPLACE INTO stocks (Date, Ticker, CompanyName, Open, High, Low, Close, Volume)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    stock['date'], stock['ticker'], stock['company_name'],
                    stock['open'], stock['high'], stock['low'], stock['close'], stock['volume']
                ))

            await conn.commit()
            logger.info(f"Saved stock data for {len(stocks_data)} records")

    except Exception as e:
        logger.error(f"Error saving stock data: {str(e)}")
        raise

async def get_fundamental_data(ticker: str) -> Optional[Dict]:
    """Get fundamental data for a ticker"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT * FROM fundamental_data WHERE Ticker = ?",
                (ticker.upper(),)
            )
            row = await cursor.fetchone()

            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))

    except Exception as e:
        logger.error(f"Error getting fundamental data for {ticker}: {str(e)}")

    return None

async def save_fundamental_data(fundamental_data: List[Dict]):
    """Save fundamental data to database"""
    try:
        async with get_db_connection() as conn:
            for data in fundamental_data:
                await conn.execute('''
                    INSERT OR REPLACE INTO fundamental_data
                    (Ticker, CompanyName, EPS, PE_Ratio, PBV, ROE, Debt_to_Equity, Market_Cap, Last_Updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    data['ticker'], data['company_name'], data['eps'], data['pe_ratio'],
                    data['pbv'], data['roe'], data['debt_to_equity'], data['market_cap'],
                    data['last_updated']
                ))

            await conn.commit()
            logger.info(f"Saved fundamental data for {len(fundamental_data)} records")

    except Exception as e:
        logger.error(f"Error saving fundamental data: {str(e)}")
        raise

async def get_news_data(ticker: str) -> List[Dict]:
    """Get news data for a ticker"""
    try:
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT title, url, published_date, source FROM news WHERE ticker = ? ORDER BY published_date DESC",
                (ticker.upper(),)
            )
            rows = await cursor.fetchall()

            return [
                {
                    'title': row[0],
                    'url': row[1],
                    'published_date': row[2],
                    'source': row[3]
                }
                for row in rows
            ]

    except Exception as e:
        logger.error(f"Error getting news data for {ticker}: {str(e)}")
        return []

async def save_news_data(news_data: List[Dict]):
    """Save news data to database"""
    try:
        async with get_db_connection() as conn:
            for news in news_data:
                await conn.execute('''
                    INSERT OR REPLACE INTO news (ticker, title, url, published_date, source, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    news['ticker'], news['title'], news['url'],
                    news['published_date'], news['source'],
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ))

            await conn.commit()
            logger.info(f"Saved news data for {len(news_data)} records")

    except Exception as e:
        logger.error(f"Error saving news data: {str(e)}")
        raise

async def cleanup_old_data(days_to_keep: int = 30):
    """Clean up old data from databases"""
    try:
        cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).strftime('%Y-%m-%d %H:%M:%S')

        # Clean crypto data
        async with get_db_connection(DB_NAME) as conn:
            await conn.execute("DELETE FROM coins WHERE timestamp < ?", (cutoff_date,))
            await conn.execute("DELETE FROM metadata WHERE timestamp < ?", (cutoff_date,))
            await conn.commit()

        # Clean news data
        async with get_db_connection() as conn:
            await conn.execute("DELETE FROM news WHERE last_updated < ?", (cutoff_date,))
            await conn.commit()

        logger.info(f"Cleaned up data older than {days_to_keep} days")

    except Exception as e:
        logger.error(f"Error cleaning up old data: {str(e)}")
        raise

async def get_database_stats() -> Dict[str, int]:
    """Get database statistics"""
    try:
        stats = {}

        # Stock database stats
        async with get_db_connection() as conn:
            cursor = await conn.execute("SELECT COUNT(*) FROM stocks")
            stats['stocks_count'] = (await cursor.fetchone())[0]

            cursor = await conn.execute("SELECT COUNT(*) FROM users")
            stats['users_count'] = (await cursor.fetchone())[0]

            cursor = await conn.execute("SELECT COUNT(*) FROM watchlist")
            stats['watchlist_count'] = (await cursor.fetchone())[0]

        # Crypto database stats
        async with get_db_connection(DB_NAME) as conn:
            cursor = await conn.execute("SELECT COUNT(*) FROM coins")
            stats['crypto_count'] = (await cursor.fetchone())[0]

        return stats

    except Exception as e:
        logger.error(f"Error getting database stats: {str(e)}")
        return {}

async def backup_database():
    """Create database backup"""
    try:
        import shutil
        from datetime import datetime

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Backup main database
        backup_path = f"{DATABASE_PATH}.backup_{timestamp}"
        shutil.copy2(DATABASE_PATH, backup_path)

        # Backup crypto database
        crypto_backup_path = f"{DB_NAME}.backup_{timestamp}"
        shutil.copy2(DB_NAME, crypto_backup_path)

        logger.info(f"Database backup created: {backup_path}, {crypto_backup_path}")

    except Exception as e:
        logger.error(f"Error creating database backup: {str(e)}")
        raise

# User account management functions
async def get_user_accounts_file(user_id: int) -> str:
    """Get user accounts file path"""
    return f"akun_{user_id}.json"

async def initialize_user_accounts(user_id: int):
    """Initialize user accounts"""
    try:
        account_file = await get_user_accounts_file(user_id)
        if not os.path.exists(account_file):
            accounts = {
                f"account_{i}": {
                    "balance": DEFAULT_BALANCE,
                    "transactions": []
                } for i in range(1, 11)
            }
            data = {
                "accounts": accounts,
                "active_account": "account_1"
            }

            with file_lock:
                with open(account_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=4)

            logger.info(f"Initialized accounts for user {user_id}")

    except Exception as e:
        logger.error(f"Error initializing accounts for {user_id}: {str(e)}")
        raise

async def get_user_accounts(user_id: int) -> Dict:
    """Get user accounts data"""
    try:
        await initialize_user_accounts(user_id)
        account_file = await get_user_accounts_file(user_id)

        with file_lock:
            with open(account_file, "r", encoding="utf-8") as f:
                data = json.load(f)

        return data

    except Exception as e:
        logger.error(f"Error getting accounts for {user_id}: {str(e)}")
        return {"accounts": {}, "active_account": "account_1"}

async def save_user_accounts(user_id: int, data: Dict):
    """Save user accounts data"""
    try:
        account_file = await get_user_accounts_file(user_id)

        with file_lock:
            with open(account_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4)

        logger.info(f"Saved accounts for user {user_id}")

    except Exception as e:
        logger.error(f"Error saving accounts for {user_id}: {str(e)}")
        raise

async def get_user_transactions(user_id: int) -> List[Dict]:
    """Get user transactions from active account"""
    try:
        data = await get_user_accounts(user_id)
        active_account = data.get("active_account", "account_1")

        if active_account not in data.get("accounts", {}):
            return []

        transactions = data["accounts"][active_account].get("transactions", [])
        return transactions

    except Exception as e:
        logger.error(f"Error getting transactions for {user_id}: {str(e)}")
        return []

async def save_user_transaction(user_id: int, transaction: Dict):
    """Save transaction to user account"""
    try:
        data = await get_user_accounts(user_id)
        active_account = data.get("active_account", "account_1")

        if active_account not in data.get("accounts", {}):
            raise ValueError(f"Account {active_account} not found")

        if "transactions" not in data["accounts"][active_account]:
            data["accounts"][active_account]["transactions"] = []

        data["accounts"][active_account]["transactions"].append(transaction)
        await save_user_accounts(user_id, data)

        logger.info(f"Saved transaction for user {user_id} in account {active_account}")

    except Exception as e:
        logger.error(f"Error saving transaction for {user_id}: {str(e)}")
        raise

# Cache management
cache = {}

async def get_cached_data(key: str, ttl_seconds: int = 300):
    """Get cached data if not expired"""
    if key in cache:
        data, timestamp = cache[key]
        if datetime.now().timestamp() - timestamp < ttl_seconds:
            return data
        else:
            del cache[key]

    return None

async def set_cached_data(key: str, data: Any):
    """Set cached data"""
    cache[key] = (data, datetime.now().timestamp())
    logger.debug(f"Cached data for key: {key}")

# Error handling utilities
async def handle_database_error(error: Exception, operation: str):
    """Handle database errors"""
    logger.error(f"Database error during {operation}: {str(error)}")
    raise Exception(f"Database operation failed: {operation}")

# Connection management
async def close_all_connections():
    """Close all database connections"""
    await db_manager.close_all()
    logger.info("All database connections closed")