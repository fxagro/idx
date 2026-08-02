from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# Dual connection engines
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

# Dual sessionmakers
LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
RemoteSession = sessionmaker(autocommit=False, autoflush=False, bind=remote_engine)

Base = declarative_base()

# Dependency injections for FastAPI endpoints
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
