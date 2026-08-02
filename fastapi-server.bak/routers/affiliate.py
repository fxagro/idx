from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pydantic import BaseModel

from database import get_local_db
from .auth import get_current_user

router = APIRouter(
    prefix="/affiliate",
    tags=["affiliate"]
)

# Dummy Pydantic models for request bodies if needed
class ReferralLinkRequest(BaseModel):
    pass

@router.get("/dashboard")
def get_affiliate_dashboard(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    
    # Get total direct referrals
    direct_referrals_query = text("""
        SELECT COUNT(*) FROM affiliate_referrals 
        WHERE referrer_user_id = :user_id AND level = 1
    """)
    direct_referrals = db.execute(direct_referrals_query, {"user_id": user_id}).scalar() or 0
    
    # Get total referrals (level 1 & 2)
    total_referrals_query = text("""
        SELECT COUNT(*) FROM affiliate_referrals 
        WHERE referrer_user_id = :user_id
    """)
    total_referrals = db.execute(total_referrals_query, {"user_id": user_id}).scalar() or 0
    
    # Get total earned
    total_earned_query = text("""
        SELECT SUM(amount) FROM affiliate_commissions 
        WHERE user_id = :user_id
    """)
    total_earned = db.execute(total_earned_query, {"user_id": user_id}).scalar() or 0.0
    
    # Get monthly earned
    current_month = datetime.now().strftime("%Y-%m")
    monthly_earned_query = text("""
        SELECT SUM(amount) FROM affiliate_commissions 
        WHERE user_id = :user_id AND TO_CHAR(created_at, 'YYYY-MM') = :month
    """)
    monthly_earned = db.execute(monthly_earned_query, {"user_id": user_id, "month": current_month}).scalar() or 0.0
    
    # Check if user has a link
    link_query = text("""
        SELECT referral_link FROM affiliate_referrals 
        WHERE referrer_user_id = :user_id AND level = 0 LIMIT 1
    """)
    # Level 0 is not in the check constraint, maybe the link is stored in users table?
    # Wait, the table schema says level check is ANY(ARRAY[1,2]). 
    # Let's check users table or just query a link where referrer_user_id = user_id
    
    # Let's return the dashboard stats
    return {
        "total_referrals": total_referrals,
        "direct_referrals": direct_referrals,
        "total_earned": float(total_earned),
        "monthly_earned": float(monthly_earned),
        "referral_link": f"https://idx.mytriv.com/register?ref={current_user.username}"
    }

@router.get("/network")
def get_affiliate_network(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    
    # Get basic stats
    stats = get_affiliate_dashboard(db, current_user)
    
    # Get Level 1 downlines
    l1_query = text("""
        SELECT u.id, u.username, u.email, u.created_at,
               COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE user_id = :user_id AND referral_id = r.id), 0) as total_earned,
               r.id as referral_id
        FROM affiliate_referrals r
        JOIN users u ON r.referred_user_id = u.id
        WHERE r.referrer_user_id = :user_id AND r.level = 1
        ORDER BY u.created_at DESC
    """)
    l1_results = db.execute(l1_query, {"user_id": user_id}).fetchall()
    
    downlines = []
    for l1 in l1_results:
        # Get Level 2 downlines for this user
        l2_query = text("""
            SELECT u.id, u.username, u.email, u.created_at,
                   COALESCE((SELECT SUM(amount) FROM affiliate_commissions WHERE user_id = :user_id AND referral_id = r.id), 0) as total_earned
            FROM affiliate_referrals r
            JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_user_id = :l1_user_id AND r.level = 1
        """)
        l2_results = db.execute(l2_query, {"user_id": user_id, "l1_user_id": l1.id}).fetchall()
        
        l2_downlines = []
        for l2 in l2_results:
            l2_downlines.append({
                "id": l2.id,
                "username": l2.username,
                "email": l2.email,
                "created_at": l2.created_at,
                "total_earned": float(l2.total_earned),
                "downlines": []
            })
            
        downlines.append({
            "id": l1.id,
            "username": l1.username,
            "email": l1.email,
            "created_at": l1.created_at,
            "total_earned": float(l1.total_earned),
            "downlines": l2_downlines
        })
        
    stats["downlines"] = downlines
    return stats

@router.get("/commissions")
def get_commissions(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    
    query = text("""
        SELECT c.id, c.amount, c.level, c.created_at, u.username as referral_username
        FROM affiliate_commissions c
        LEFT JOIN affiliate_referrals r ON c.referral_id = r.id
        LEFT JOIN users u ON r.referred_user_id = u.id
        WHERE c.user_id = :user_id
        ORDER BY c.created_at DESC
        LIMIT 50
    """)
    results = db.execute(query, {"user_id": user_id}).fetchall()
    
    return [
        {
            "id": row.id,
            "amount": float(row.amount),
            "level": row.level,
            "created_at": row.created_at,
            "referral_username": row.referral_username or "Unknown"
        }
        for row in results
    ]

@router.post("/generate-link")
def generate_link(db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    # Since user wants username as referral link, we just return the formatted link
    username = current_user.username
    return {
        "success": True,
        "referral_link": f"https://idx.mytriv.com/register?ref={username}",
        "referral_code": username
    }
