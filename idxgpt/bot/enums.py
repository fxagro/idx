"""
Enums for BJB Sekuritas Telegram Bot
Contains state machine enums and other enumerations
"""

from enum import Enum

class MenuState(Enum):
    """Menu state enumeration for conversation flow"""
    MAIN_MENU = "main_menu"
    SUBMENU = "submenu"
    SAHAM = "saham"
    CRYPTO = "crypto"
    GLOBAL_MARKET = "global_market"
    LAINNYA = "lainnya"
    SETTINGS = "settings"
    ABOUT = "about"
    HELP = "help"
    SUBSCRIPTION = "subscription"
    JOIN_GROUP = "join_group"

class SubscriptionType(Enum):
    """Subscription type enumeration"""
    FREE = "free"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    BJB_ACCOUNT = "bjb_account"

class TransactionStatus(Enum):
    """Transaction status enumeration"""
    OPEN = "open"
    CLOSED = "closed"

class ExploreMode(Enum):
    """Crypto exploration mode enumeration"""
    EXPLORE = "explore"
    SEARCH_SYMBOL = "search_symbol"

class PeriodType(Enum):
    """Period type enumeration for analysis"""
    DAILY = "harian"
    WEEKLY = "mingguan"
    MONTHLY = "bulanan"
    CUSTOM = "custom"

class IndexType(Enum):
    """Index type enumeration"""
    LQ45 = "lq45"
    KOMPAS100 = "kompas100"
    JII70 = "jii70"
    MBX = "mbx"
    ISSI = "issi"

class AccessLevel(Enum):
    """Access level enumeration"""
    FREE = "free"
    PREMIUM = "premium"
    ADMIN = "admin"

class ErrorType(Enum):
    """Error type enumeration"""
    DATABASE_ERROR = "database_error"
    API_ERROR = "api_error"
    VALIDATION_ERROR = "validation_error"
    PERMISSION_ERROR = "permission_error"
    NETWORK_ERROR = "network_error"
    UNKNOWN_ERROR = "unknown_error"

class LogLevel(Enum):
    """Log level enumeration"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"