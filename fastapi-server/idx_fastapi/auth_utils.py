import jwt
import datetime
import secrets
import bcrypt
from .config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Enforce bytes comparison
        pwd_bytes = plain_password.encode('utf-8')
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception as e:
        print(f"Bcrypt verification error: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(10) # 10 rounds matches VPS3 and standard bcrypt
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def create_access_token(user_id: int, email: str, role: str) -> str:
    jti = secrets.token_hex(16)
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "id": user_id,
        "email": email,
        "role": role,
        "jti": jti,
        "exp": expire
    }
    
    encoded_jwt = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    try:
        decoded = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return decoded
    except Exception:
        return None
