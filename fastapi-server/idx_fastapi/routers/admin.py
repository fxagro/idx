from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from .auth import get_current_user, RequireRole
from ..database import get_local_db, get_remote_db

router = APIRouter(tags=["Admin"])

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    account_type: str = "KONVENSIONAL"
    ai_quota: int
    referral_code: Optional[str] = None
    created_at: Optional[datetime] = None
    referral_count: int = 0
    total_commissions: int = 0
    total_earned: float = 0.0

@router.get("/users/affiliate", response_model=List[UserResponse])
def get_admin_users_affiliate(current_user: dict = Depends(RequireRole(["admin", "superadmin"])), db: Session = Depends(get_local_db)):
    """Get all users with their affiliate data for the admin dashboard"""
    try:
        query = text("""
            SELECT
                u.id,
                u.email,
                u.role,
                u.account_type,
                u.ai_quota,
                u.referral_code,
                u.created_at,
                COALESCE(r.referral_count, 0) as referral_count,
                COALESCE(c.total_commissions, 0) as total_commissions,
                COALESCE(c.total_earned, 0) as total_earned
            FROM users u
            LEFT JOIN (
                SELECT referred_by, COUNT(*) as referral_count
                FROM users
                WHERE referred_by IS NOT NULL
                GROUP BY referred_by
            ) r ON u.id = r.referred_by
            LEFT JOIN (
                SELECT user_id,
                       COUNT(*) as total_commissions,
                       SUM(amount) as total_earned
                FROM affiliate_commissions
                GROUP BY user_id
            ) c ON u.id = c.user_id
            ORDER BY u.created_at DESC
        """)
        users = db.execute(query).mappings().fetchall()
        return users
    except Exception as e:
        print(f"Error fetching admin users affiliate: {e}")
        raise HTTPException(status_code=500, detail="Server error")

class UpdateQuotaRequest(BaseModel):
    userId: int
    aiQuota: int

@router.post("/updateQuota")
def update_user_quota(req: UpdateQuotaRequest, current_user: dict = Depends(RequireRole(["admin", "superadmin"])), db: Session = Depends(get_local_db)):
    if req.aiQuota < 0:
        raise HTTPException(status_code=400, detail="Quota cannot be negative")
    
    try:
        query = text("UPDATE users SET ai_quota = :quota WHERE id = :id RETURNING id, email, ai_quota")
        updated_user = db.execute(query, {"quota": req.aiQuota, "id": req.userId}).mappings().fetchone()
        db.commit()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {
            "success": True,
            "user": dict(updated_user),
            "message": f"AI quota updated to {req.aiQuota}"
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Update quota error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

class UpdateVirtualSaldoRequest(BaseModel):
    userId: int
    virtualSaldo: float

@router.post("/updateVirtualSaldo")
def update_virtual_saldo(req: UpdateVirtualSaldoRequest, current_user: dict = Depends(RequireRole(["admin", "superadmin"])), db: Session = Depends(get_local_db)):
    if req.virtualSaldo < 0:
        raise HTTPException(status_code=400, detail="Virtual saldo cannot be negative")
        
    try:
        query = text("UPDATE users SET virtual_saldo = :saldo WHERE id = :id RETURNING id, email, virtual_saldo")
        updated_user = db.execute(query, {"saldo": req.virtualSaldo, "id": req.userId}).mappings().fetchone()
        db.commit()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {
            "success": True,
            "user": dict(updated_user),
            "message": f"Virtual balance updated to {req.virtualSaldo} IDR"
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Update virtual balance error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

class UpdateUserRequest(BaseModel):
    userId: int
    newPassword: Optional[str] = None
    referralCode: Optional[str] = None

@router.post("/updateUser")
def update_user(req: UpdateUserRequest, current_user: dict = Depends(RequireRole(["admin", "superadmin"])), db: Session = Depends(get_local_db)):
    updates = []
    params = {"id": req.userId}
    
    if req.newPassword:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash(req.newPassword)
        updates.append("password = :password")
        params["password"] = hashed_password
        
    if req.referralCode is not None:
        import re
        if not re.match(r"^[a-zA-Z0-9_-]{4,20}$", req.referralCode):
            raise HTTPException(status_code=400, detail="Invalid referral code format")
            
        existing = db.execute(text("SELECT id FROM users WHERE referral_code = :ref AND id != :id"), {"ref": req.referralCode, "id": req.userId}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Referral code already exists")
        
        updates.append("referral_code = :refcode")
        params["refcode"] = req.referralCode
        
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
        
    try:
        query = text(f"UPDATE users SET {', '.join(updates)} WHERE id = :id RETURNING id, email, referral_code")
        updated_user = db.execute(query, params).mappings().fetchone()
        db.commit()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {
            "success": True,
            "user": dict(updated_user),
            "message": "User updated successfully"
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Update user error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

# Internal Users RBAC endpoints
class CreateInternalUserRequest(BaseModel):
    email: str
    password: str
    role: str

@router.get("/internal-users")
def get_internal_users(current_user: dict = Depends(RequireRole(["superadmin"])), db: Session = Depends(get_local_db)):
    try:
        query = text("SELECT id, email, role, created_at FROM users WHERE role IN ('admin', 'superadmin', 'admin_finance', 'admin_oms', 'admin_risk', 'admin_custodian') ORDER BY created_at DESC")
        users = db.execute(query).mappings().fetchall()
        return users
    except Exception as e:
        print(f"Error fetching internal users: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/internal-users")
def create_internal_user(req: CreateInternalUserRequest, current_user: dict = Depends(RequireRole(["superadmin"])), db: Session = Depends(get_local_db)):
    valid_roles = ["admin", "superadmin", "admin_finance", "admin_oms", "admin_risk", "admin_custodian"]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {valid_roles}")
        
    try:
        existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": req.email}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
            
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash(req.password)
        
        query = text("""
            INSERT INTO users (email, password, role, status, is_active, created_at, virtual_saldo, ai_quota, ai_limit)
            VALUES (:email, :password, :role, 'active', true, NOW(), 0, 10, 10)
            RETURNING id, email, role, created_at
        """)
        new_user = db.execute(query, {
            "email": req.email, 
            "password": hashed_password, 
            "role": req.role
        }).mappings().fetchone()
        db.commit()
        return {"success": True, "user": dict(new_user), "message": "Internal admin created successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Create internal user error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

class UpdateInternalUserRoleRequest(BaseModel):
    role: str

@router.put("/internal-users/{user_id}/role")
def update_internal_user_role(user_id: int, req: UpdateInternalUserRoleRequest, current_user: dict = Depends(RequireRole(["superadmin"])), db: Session = Depends(get_local_db)):
    valid_roles = ["user", "admin", "superadmin", "admin_finance", "admin_oms", "admin_risk", "admin_custodian"]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {valid_roles}")
        
    try:
        if getattr(current_user, 'id', None) == user_id and req.role != 'superadmin':
            raise HTTPException(status_code=400, detail="Cannot demote yourself from superadmin")
            
        query = text("UPDATE users SET role = :role WHERE id = :id RETURNING id, email, role")
        updated_user = db.execute(query, {"role": req.role, "id": user_id}).mappings().fetchone()
        db.commit()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"success": True, "user": dict(updated_user), "message": "User role updated successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Update internal user role error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.delete("/internal-users/{user_id}")
def delete_internal_user(user_id: int, current_user: dict = Depends(RequireRole(["superadmin"])), db: Session = Depends(get_local_db)):
    try:
        if getattr(current_user, 'id', None) == user_id:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")
            
        user = db.execute(text("SELECT role FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        db.commit()
        
        return {"success": True, "message": "Admin user deleted successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Delete internal user error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

class UpdateAccountTypeRequest(BaseModel):
    account_type: str

@router.put("/users/{user_id}/account-type")
def update_user_account_type(
    user_id: int, 
    req: UpdateAccountTypeRequest, 
    current_user: dict = Depends(RequireRole(["admin", "superadmin"])), 
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    if req.account_type not in ("KONVENSIONAL", "SYARIAH"):
        raise HTTPException(status_code=400, detail="Account type must be KONVENSIONAL or SYARIAH")
        
    try:
        # Update local
        db.execute(text("UPDATE users SET account_type = :at WHERE id = :id"), {"at": req.account_type, "id": user_id})
        db.commit()
        
        # Update remote - get email from local first
        user = db.execute(text("SELECT email FROM users WHERE id = :id"), {"id": user_id}).fetchone()
        if user:
            remote_db.execute(text("UPDATE users SET account_type = :at WHERE email = :email"), {"at": req.account_type, "email": user[0]})
            remote_db.commit()
            
        return {"success": True, "message": f"Account type updated to {req.account_type}"}
    except Exception as e:
        db.rollback()
        print(f"Update account type error: {e}")
        raise HTTPException(status_code=500, detail="Server error")
