import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

local_engine = create_engine(
    settings.LOCAL_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

remote_engine = create_engine(
    settings.REMOTE_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
RemoteSession = sessionmaker(autocommit=False, autoflush=False, bind=remote_engine)

Base = declarative_base()

REMOTE_TABLE_PREFIXES = ('pe_',)

REMOTE_TABLES = {
    'stock_daily', 'index_constituents', 'signals',
    'broker_transactions', 'broker_holdings', 'idx_dates',
    'journal_entries', 'chart_of_accounts', 'subsidiary_ledger',
    'stock_codes', 'market_news', 'market_signals', 'recommendations',
    'fundamental_data', 'orderbook',
}

class DBRouter:
    def __init__(self, local_session, remote_session):
        self.local = local_session
        self.remote = remote_session

    def _resolve_db(self, statement):
        sql = str(statement).lower()
        if re.search(r'\bpe_[a-z_]+\b', sql):
            return self.remote
        for table in REMOTE_TABLES:
            if table.lower() in sql:
                return self.remote
        return self.local

    def execute(self, statement, params=None):
        db = self._resolve_db(statement)
        return db.execute(statement, params)

    def commit(self):
        self.local.commit()
        self.remote.commit()

    def rollback(self):
        self.local.rollback()
        self.remote.rollback()

    def close(self):
        self.local.close()
        self.remote.close()


def get_local_db():
    db = LocalSession()
    try:
        yield db
    finally:
        db.close()


def get_remote_db():
    db = RemoteSession()
    try:
        yield db
    finally:
        db.close()


def get_db():
    local = LocalSession()
    remote = RemoteSession()
    try:
        yield DBRouter(local, remote)
    finally:
        local.close()
        remote.close()