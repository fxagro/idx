from sqlalchemy import Column, Integer, String, Text, Numeric, Date, DateTime, func
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(Text, unique=True, nullable=False)
    password = Column(Text, nullable=False)
    role = Column(String, default="user")
    status = Column(String, default="active")
    referral_code = Column(String, nullable=True)
    referred_by = Column(Integer, nullable=True)
    virtual_saldo = Column(Numeric, default=100000000)  # default virtual saldo 100jt
    referral_count = Column(Integer, default=0)
    ai_quota = Column(Integer, default=10)
    ai_usage = Column(Integer, default=0)
    ai_limit = Column(Integer, default=10)
    api_limit = Column(Integer, default=100)
    api_usage = Column(Integer, default=0)
    subscription_expiry = Column(Date, nullable=True)
    avatar = Column(Text, nullable=True)
    auth_method = Column(String, default="password")
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
