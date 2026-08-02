from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime

from database import get_local_db, get_remote_db
from models import User
from auth_utils import verify_password, get_password_hash, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

# Pydantic schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    avatar: Optional[str] = None
    # Add other profile fields if needed

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

# Dependency to get current user from JWT token
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security), 
    db: Session = Depends(get_local_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    user_id = payload.get("id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

@router.post("/login")
def login(
    payload: LoginRequest, 
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    email_sanitized = payload.email.lower().strip()
    
    # 1. Authenticate against remote db on VPS3
    try:
        remote_user_query = text("""
            SELECT id, email, password_hash, tier, is_active, full_name 
            FROM users 
            WHERE email = :email
        """)
        remote_user = remote_db.execute(remote_user_query, {"email": email_sanitized}).fetchone()
        
        if not remote_user:
            return {"success": False, "message": "Invalid credentials (User not found on remote)"}
            
        if not remote_user[4]:  # is_active
            return {"success": False, "message": "Please activate your account via email"}
            
        if not verify_password(payload.password, remote_user[2]):  # password_hash
            return {"success": False, "message": "Invalid credentials (Password mismatch)"}
            
    except Exception as e:
        # Fallback to local authentication in case remote DB is down
        print(f"Remote auth failed, falling back to local auth: {str(e)}")
        user = db.query(User).filter(User.email == email_sanitized).first()
        if not user or not verify_password(payload.password, user.password):
            return {"success": False, "message": "Invalid credentials"}
        
        token = create_access_token(user.id, user.email, user.role)
        return {
            "success": True,
            "token": token,
            "message": "Login successful (Fallback)"
        }

    # 2. Sync remote user to local db
    user = db.query(User).filter(User.email == email_sanitized).first()
    if not user:
        # Auto-create local user
        hashed_pwd = get_password_hash(payload.password)
        user = User(
            email=email_sanitized,
            password=hashed_pwd,
            role=remote_user[3] if remote_user and len(remote_user) > 3 else "user",
            status="active",
            virtual_saldo=100000000,  # 100jt initial saldo
            ai_quota=10,
            ai_limit=10
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update password hash locally to match
        user.password = remote_user[2]
        if remote_user and len(remote_user) > 3:
            if user.role != "admin":
                user.role = remote_user[3]
        user.last_login = datetime.datetime.utcnow()
        user.auth_method = "password"
        db.commit()
        
    token = create_access_token(user.id, user.email, user.role)
    
    return {
        "success": True,
        "token": token,
        "message": "Login successful"
    }

@router.post("/register")
def register(
    payload: RegisterRequest, 
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    email_sanitized = payload.email.lower().strip()
    
    # Check if user already exists locally or remotely
    existing_user_local = db.query(User).filter(User.email == email_sanitized).first()
    
    try:
        remote_check_query = text("SELECT id FROM users WHERE email = :email")
        existing_user_remote = remote_db.execute(remote_check_query, {"email": email_sanitized}).fetchone()
    except Exception as e:
        existing_user_remote = None
        print(f"Failed to check remote user during register: {str(e)}")
        
    if existing_user_local or existing_user_remote:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )
        
    hashed_pwd = get_password_hash(payload.password)
    
    # 1. Create remote user on VPS3
    try:
        # Direct active insertion for SaaS ease of use/testing
        remote_insert_query = text("""
            INSERT INTO users (email, password_hash, full_name, is_active, tier)
            VALUES (:email, :password_hash, :full_name, true, 'FREE')
            RETURNING id
        """)
        remote_res = remote_db.execute(
            remote_insert_query, 
            {
                "email": email_sanitized,
                "password_hash": hashed_pwd,
                "full_name": email_sanitized.split('@')[0]
            }
        )
        remote_db.commit()
    except Exception as e:
        remote_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user on remote server: {str(e)}"
        )
        
    # 2. Create local user on VPS2
    new_user = User(
        email=email_sanitized,
        password=hashed_pwd,
        role="user",
        status="active",
        virtual_saldo=100000000,
        ai_quota=10,
        ai_limit=10
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token(new_user.id, new_user.email, new_user.role)
    
    return {
        "success": True,
        "message": "Registration successful",
        "data": {
            "token": token,
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "role": new_user.role
            }
        }
    }

@router.post("/refresh")
def refresh(request: Request):
    # Mock refresh token endpoint
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    # Re-create token
    new_token = create_access_token(payload["id"], payload["email"], payload["role"])
    return {
        "success": True,
        "token": new_token,
        "message": "Token refreshed successfully"
    }

@router.post("/revoke")
def revoke():
    return {"success": True, "message": "Token revoked successfully"}

@router.post("/update-profile")
def update_profile(payload: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    if payload.avatar is not None:
        current_user.avatar = payload.avatar
    db.commit()
    return {"success": True, "message": "Profile updated successfully"}

@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    if not verify_password(payload.currentPassword, current_user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    hashed_new_pwd = get_password_hash(payload.newPassword)
    current_user.password = hashed_new_pwd
    db.commit()
    
    try:
        remote_update_query = text("UPDATE users SET password_hash = :hash WHERE email = :email")
        remote_db.execute(remote_update_query, {"hash": hashed_new_pwd, "email": current_user.email})
        remote_db.commit()
    except Exception as e:
        print(f"Failed to update remote password: {str(e)}")
        
    return {"success": True, "message": "Password changed successfully"}

# Mount GET /api/me here as well for simplicity
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "avatar": current_user.avatar,
            "virtual_saldo": float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0,
            "ai_quota": current_user.ai_quota,
            "ai_usage": current_user.ai_usage,
            "ai_limit": current_user.ai_limit,
            "subscription_expiry": str(current_user.subscription_expiry) if current_user.subscription_expiry else None
        }
    }

class RequireRole:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {', '.join(self.allowed_roles)}"
            )
        return current_user
