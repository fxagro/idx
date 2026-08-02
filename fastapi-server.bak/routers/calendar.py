from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import datetime
import random
from database import get_local_db
from .auth import get_current_user
from models import User

router = APIRouter()

IPO_DATA = [
    {"symbol": "CUAN", "name": "PT Cuan Indo Sejahtera Tbk", "date": "2026-06-15", "price": 500, "shares": 2500000000, "sector": "Energy", "status": "upcoming"},
    {"symbol": "TECH", "name": "PT Teknologi Maju Tbk", "date": "2026-06-22", "price": 1000, "shares": 1500000000, "sector": "Technology", "status": "upcoming"},
    {"symbol": "HEAL", "name": "PT Sehat Sentosa Tbk", "date": "2026-07-01", "price": 750, "shares": 1800000000, "sector": "Healthcare", "status": "upcoming"},
    {"symbol": "PROP", "name": "PT Properti Nusantara Tbk", "date": "2026-05-10", "price": 300, "shares": 3200000000, "sector": "Property", "status": "listed"},
    {"symbol": "FOOD", "name": "PT Pangan Sejahtera Tbk", "date": "2026-04-20", "price": 450, "shares": 2000000000, "sector": "Consumer", "status": "listed"},
    {"symbol": "BANK", "name": "PT Bank Digital Asia Tbk", "date": "2026-03-15", "price": 800, "shares": 5000000000, "sector": "Finance", "status": "listed"},
    {"symbol": "META", "name": "PT Meta Digital Kreasi Tbk", "date": "2026-08-05", "price": 1200, "shares": 1000000000, "sector": "Technology", "status": "upcoming"},
    {"symbol": "GREEN", "name": "PT Energi Hijau Lestari Tbk", "date": "2026-08-20", "price": 600, "shares": 2200000000, "sector": "Energy", "status": "upcoming"},
]

DIVIDEND_DATA = [
    {"symbol": "BBCA", "name": "PT Bank Central Asia Tbk", "amount": 250, "date": "2026-06-10", "cum_date": "2026-05-28", "type": "Final", "yield": 3.2},
    {"symbol": "TLKM", "name": "PT Telkom Indonesia Tbk", "amount": 180, "date": "2026-05-20", "cum_date": "2026-05-05", "type": "Final", "yield": 4.1},
    {"symbol": "ASII", "name": "PT Astra International Tbk", "amount": 320, "date": "2026-06-05", "cum_date": "2026-05-22", "type": "Final", "yield": 5.0},
    {"symbol": "BMRI", "name": "PT Bank Mandiri Tbk", "amount": 200, "date": "2026-05-15", "cum_date": "2026-04-30", "type": "Final", "yield": 3.5},
    {"symbol": "ADRO", "name": "PT Adaro Energy Tbk", "amount": 450, "date": "2026-07-10", "cum_date": "2026-06-25", "type": "Interim", "yield": 6.2},
    {"symbol": "UNVR", "name": "PT Unilever Indonesia Tbk", "amount": 150, "date": "2026-06-20", "cum_date": "2026-06-05", "type": "Final", "yield": 2.8},
    {"symbol": "GGRM", "name": "PT Gudang Garam Tbk", "amount": 400, "date": "2026-08-15", "cum_date": "2026-07-28", "type": "Final", "yield": 5.5},
    {"symbol": "SMGR", "name": "PT Semen Indonesia Tbk", "amount": 120, "date": "2026-07-05", "cum_date": "2026-06-18", "type": "Interim", "yield": 2.1},
]

CA_DATA = [
    {"symbol": "BBCA", "name": "PT Bank Central Asia Tbk", "type": "Stock Split", "ratio": "1:5", "date": "2026-07-15", "desc": "Pemecahan saham dari Rp 62,50 menjadi Rp 12,50 per saham"},
    {"symbol": "GOTO", "name": "PT GoTo Gojek Tokopedia Tbk", "type": "Rights Issue", "ratio": "100:86", "price": 50, "date": "2026-06-01", "desc": "HMETD dengan harga pelaksanaan Rp 50 per saham"},
    {"symbol": "TLKM", "name": "PT Telkom Indonesia Tbk", "type": "Buyback", "ratio": "-", "price": 0, "date": "2026-08-01", "desc": "Pembelian kembali saham hingga Rp 3 triliun"},
    {"symbol": "ASII", "name": "PT Astra International Tbk", "type": "Dividend", "ratio": "-", "price": 0, "date": "2026-06-05", "desc": "Pembagian dividen final Rp 320 per saham"},
    {"symbol": "ADRO", "name": "PT Adaro Energy Tbk", "type": "Stock Split", "ratio": "1:10", "price": 0, "date": "2026-09-01", "desc": "Pemecahan saham untuk meningkatkan likuiditas"},
    {"symbol": "BMRI", "name": "PT Bank Mandiri Tbk", "type": "Rights Issue", "ratio": "25:1", "price": 3000, "date": "2026-10-01", "desc": "Penawaran umum terbatas dengan HMETD"},
]

@router.get("/ipo")
def get_ipo():
    upcoming = [x for x in IPO_DATA if x["status"] == "upcoming"]
    listed = [x for x in IPO_DATA if x["status"] == "listed"]
    return {"success": True, "upcoming": upcoming, "listed": listed}

@router.get("/dividend")
def get_dividend():
    today = datetime.date.today()
    upcoming = [d for d in DIVIDEND_DATA if datetime.date.fromisoformat(d["date"]) >= today]
    past = [d for d in DIVIDEND_DATA if datetime.date.fromisoformat(d["date"]) < today]
    return {"success": True, "upcoming": upcoming, "past": past}

@router.get("/corporate-actions")
def get_corporate_actions():
    today = datetime.date.today()
    upcoming = [c for c in CA_DATA if datetime.date.fromisoformat(c["date"]) >= today]
    past = [c for c in CA_DATA if datetime.date.fromisoformat(c["date"]) < today]
    return {"success": True, "upcoming": upcoming, "past": past}
