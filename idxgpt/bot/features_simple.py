"""
Feature functions for BJB Sekuritas Telegram Bot
Contains grouped functions like top_gainers variants, predictions, simulations
"""

import asyncio
import logging
import io
import os
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error

import yfinance as yf
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from config import (
    DATABASE_PATH, DB_NAME, CMC_API_KEY, NEWS_API_KEY,
    LQ45_STOCKS, KOMPAS100_STOCKS, JII70_STOCKS, MBX_STOCKS, ISSI_STOCKS,
    INDEX_STOCKS, INDICES, SECTORS, MAJOR_CURRENCIES, COMMODITIES,
    GLOBAL_INDICES, ADMIN_IDS
)
from enums import SubscriptionType, ErrorType
from utils import safe_log
from db_utils import get_db_connection
from menus import show_error_message, show_premium_required_message

# Setup logging
logger = logging.getLogger(__name__)

# Stock Analysis Features
async def check_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check stock data"""
    try:
        if not context.args:
            await update.message.reply_text(
                "Masukkan kode saham, contoh: /c BJBR",
                parse_mode="Markdown"
            )
            return

        ticker = context.args[0].upper()
        async with get_db_connection() as conn:
            cursor = await conn.execute(
                "SELECT Date, CompanyName, Close, Open, High, Low, Volume FROM stocks WHERE Ticker = ? ORDER BY Date DESC LIMIT 1",
                (ticker,)
            )
            row = await cursor.fetchone()

        if not row:
            await update.message.reply_text(
                f"Tidak ada data untuk saham {ticker}. Pastikan kode saham benar dan data tersedia.",
                parse_mode="Markdown"
            )
            return

        date, company_name, close, open_price, high, low, volume = row

        # Get company name from config if not in database
        if not company_name or company_name == "Nama tidak tersedia":
            for index_stocks in INDEX_STOCKS.values():
                if ticker in index_stocks:
                    company_name = index_stocks[ticker]
                    break

        message = (
            f"📊 *{ticker} - {company_name}*\n"
            f"Tanggal: {date}\n"
            f"Close: {close:.2f}\n"
            f"Open: {open_price:.2f}\n"
            f"High: {high:.2f}\n"
            f"Low: {low:.2f}\n"
            f"Volume: {int(volume):,}"
        )

        await update.message.reply_text(message, parse_mode="Markdown")
        logger.info(safe_log(f"Stock data sent for {ticker}"))

    except Exception as e:
        logger.error(safe_log(f"Error in check_stock: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data saham")

async def top_gainers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top gainers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df = df.dropna().nlargest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot = df_pivot.nlargest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📈 *Top Gainers ({period if is_date else period})*:\n\n"
        keyboard = []

        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                company_name = row['CompanyName']

            message += f"{ticker} ({company_name}): {change:.2f}%\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change:.2f}%", callback_data=f"tg_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_gainers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top gainers")

async def top_losers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top losers"""
    try:
        period = context.args[0].lower() if context.args else "harian"

        try:
            datetime.strptime(period, "%Y-%m-%d")
            is_date = True
        except ValueError:
            is_date = False

        async with get_db_connection() as conn:
            if is_date:
                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Open, Volume FROM stocks WHERE Date = ? AND Close IS NOT NULL AND Open IS NOT NULL AND Volume IS NOT NULL",
                    (period,)
                )
                rows = await cursor.fetchall()

                if not rows:
                    await update.message.reply_text(f"Tidak ada data saham untuk tanggal {period}.")
                    return

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Open', 'Volume'])
                df['Change'] = (df['Close'] - df['Open']) / df['Open'] * 100
                df['TransactionValue'] = df['Close'] * df['Volume']
                df = df.dropna().nsmallest(30, 'Change')

            else:
                if period == "harian":
                    days = 2
                elif period == "mingguan":
                    days = 5
                else:
                    try:
                        days = int(period)
                        if days < 2:
                            raise ValueError
                    except ValueError:
                        await update.message.reply_text("Periode tidak valid. Gunakan 'harian', 'mingguan', atau angka.")
                        return

                cursor = await conn.execute(
                    "SELECT DISTINCT Date FROM stocks ORDER BY Date DESC LIMIT ?",
                    (days,)
                )
                dates = [row[0] for row in await cursor.fetchall()]

                if len(dates) < days:
                    await update.message.reply_text(f"Data tidak cukup untuk analisis. Diperlukan minimal {days} hari.")
                    return

                start_date, end_date = dates[-1], dates[0]

                cursor = await conn.execute(
                    "SELECT Date, Ticker, CompanyName, Close, Volume FROM stocks WHERE Date IN (?, ?) AND Close IS NOT NULL AND Volume IS NOT NULL",
                    (start_date, end_date)
                )
                rows = await cursor.fetchall()

                df = pd.DataFrame(rows, columns=['Date', 'Ticker', 'CompanyName', 'Close', 'Volume'])
                df_pivot = df.pivot(index='Ticker', columns='Date', values='Close')
                df_pivot['Volume'] = df.groupby('Ticker')['Volume'].last()
                df_pivot['Change'] = (df_pivot[end_date] - df_pivot[start_date]) / df_pivot[start_date] * 100
                df_pivot['TransactionValue'] = df_pivot[end_date] * df_pivot['Volume']
                df_pivot = df_pivot.dropna().nsmallest(30, 'Change')

        if df.empty:
            await update.message.reply_text("Tidak ada data yang cukup untuk menghitung perubahan harga.")
            return

        message = f"📉 *Top Losers ({period if is_date else period})*:\n\n"
        message += f"| Ticker      | Company Name         | Change (%) | Close     | Value (Rp)  |\n"
        message += f"|-------------|----------------------|------------|-----------|-------------|\n"

        keyboard = []
        for ticker, row in df.iterrows():
            if is_date:
                change = row['Change']
                close = row['Close']
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']
            else:
                change = row['Change']
                close = row[end_date]
                trans_value = row['TransactionValue']
                company_name = row['CompanyName']

            # Format transaction value
            if trans_value >= 1000000000000:
                trans_str = f"{trans_value / 1000000000000:.2f} T"
            elif trans_value >= 1000000000:
                trans_str = f"{trans_value / 1000000000:.2f} B"
            elif trans_value >= 1000000:
                trans_str = f"{trans_value / 1000000:.2f} M"
            else:
                trans_str = f"{trans_value:,.2f}"

            message += f"| {ticker:<11} | {company_name[:18]:<20} | {change:>10.2f}% | {close:>9,.2f} | {trans_str:>11} |\n"
            keyboard.append([InlineKeyboardButton(f"{ticker} - {change:.2f}%", callback_data=f"tl_{ticker}")])

        keyboard.append([InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(message, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_losers: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil top losers")

async def top_crypto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get top crypto data"""
    try:
        async with get_db_connection(DB_NAME) as conn:
            cursor = await conn.execute(
                "SELECT MAX(timestamp) FROM metadata"
            )
            latest_timestamp = await cursor.fetchone()

            if not latest_timestamp:
                await update.message.reply_text("Data cryptocurrency tidak ditemukan. Memperbarui data sekarang...")
                return

            timestamp = latest_timestamp[0]
            cursor = await conn.execute(
                "SELECT symbol, name, price_usd, market_cap, percent_change_24h FROM coins WHERE timestamp = ? ORDER BY market_cap DESC LIMIT 10",
                (timestamp,)
            )
            rows = await cursor.fetchall()

        if not rows:
            await update.message.reply_text("Tidak ada data cryptocurrency yang tersedia saat ini.")
            return

        message = "💰 *Top 10 Cryptocurrencies by Market Cap*:\n\n"
        for row in rows:
            symbol, name, price, market_cap, change = row
            message += f"{name} ({symbol})\nHarga: ${price:,.2f}\nMarket Cap: ${market_cap:,.0f}\nPerubahan 24h: {change:+.2f}%\n\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in top_crypto: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data crypto")

async def global_indices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get global indices data"""
    try:
        indices_data = []

        for name, symbol in GLOBAL_INDICES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    indices_data.append({
                        "Index": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if len(indices_data) < 3:
            await update.message.reply_text("Data indeks global tidak cukup. Silakan coba lagi nanti.")
            return

        df = pd.DataFrame(indices_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Index'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            plt.text(width + 50, bar.get_y() + bar.get_height()/2,
                    f"{width:,.2f} ({change:+.2f}%)",
                    ha='left', va='center', fontsize=10)

        plt.title("Harga Indeks Global Terbaru", fontsize=14, pad=20)
        plt.xlabel("Harga Penutupan", fontsize=12)
        plt.ylabel("Indeks", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "global_indices_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Indeks Global Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in global_indices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data indeks global")

async def commodity_prices(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get commodity prices"""
    try:
        results = []

        for name, symbol in COMMODITIES.items():
            try:
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="5d")

                if not data.empty:
                    latest_close = data['Close'][-1]
                    if len(data) >= 2:
                        previous_close = data['Close'][-2]
                        change_percent = (latest_close - previous_close) / previous_close * 100
                        change_str = f"🟢 +{change_percent:+.2f}%" if change_percent > 0 else f"🔴 {change_percent:+.2f}%" if change_percent < 0 else "⚪ 0.00%"
                    else:
                        change_str = "⚪ N/A"

                    results.append(f"{name}: ${latest_close:,.2f} {change_str}")
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if results:
            message = "📈 *Harga Komoditas Terkini*\n\n" + "\n".join(results)
        else:
            message = "📈 *Harga Komoditas Terkini*\n\nMaaf, tidak ada data komoditas yang tersedia saat ini."

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in commodity_prices: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil harga komoditas")

async def major_currencies(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get major currencies data"""
    try:
        currencies_data = []

        for name, symbol in MAJOR_CURRENCIES.items():
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="2d")
                if len(hist) >= 2:
                    last_price = hist['Close'].iloc[-1]
                    prev_price = hist['Close'].iloc[-2]
                    change_percent = (last_price - prev_price) / prev_price * 100
                    currencies_data.append({
                        "Currency": name,
                        "Last Price": last_price,
                        "Change (%)": change_percent
                    })
            except Exception as e:
                logger.warning(safe_log(f"Failed to fetch {name}: {str(e)}"))
                continue

        if not currencies_data:
            await update.message.reply_text("Gagal mengambil data untuk semua pasangan mata uang.")
            return

        df = pd.DataFrame(currencies_data)
        colors = ['green' if change >= 0 else 'red' for change in df['Change (%)']]

        plt.figure(figsize=(12, 8))
        bars = plt.barh(df['Currency'], df['Last Price'], color=colors)

        for i, bar in enumerate(bars):
            width = bar.get_width()
            change = df['Change (%)'].iloc[i]
            currency = df['Currency'].iloc[i]

            if currency in ["USD/IDR", "USD/INR", "USD/RUB"]:
                label = f"{width:,.2f} ({change:+.2f}%)"
            else:
                label = f"{width:.4f} ({change:+.2f}%)"

            plt.text(width + max(width * 0.05, 0.01), bar.get_y() + bar.get_height()/2,
                    label, ha='left', va='center', fontsize=10)

        plt.title("Harga Major Currencies Terbaru", fontsize=14, pad=20)
        plt.xlabel("Nilai Tukar", fontsize=12)
        plt.ylabel("Pasangan Mata Uang", fontsize=12)
        plt.text(0, -0.5, "Created @Bjb_SinyalBot Bisnis-IT.com/trader",
                ha='left', va='bottom', fontsize=10, color='gray')

        plt.tight_layout()

        chart_path = "major_currencies_chart.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

        with open(chart_path, 'rb') as photo:
            await update.message.reply_text("Harga Major Currencies Terbaru:")
            await update.message.reply_photo(photo=photo)

        os.remove(chart_path)

    except Exception as e:
        logger.error(safe_log(f"Error in major_currencies: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil data mata uang")

async def watch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add to watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /watch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        from db_utils import add_to_watchlist
        await add_to_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} ditambahkan ke watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in watch: {str(e)}"))
        await show_error_message(update, context, "Gagal menambah ke watchlist")

async def unwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove from watchlist"""
    try:
        if not context.args:
            await update.message.reply_text("Masukkan kode saham, contoh: /unwatch BJBR")
            return

        ticker = context.args[0].upper()
        user_id = update.effective_user.id

        from db_utils import remove_from_watchlist
        await remove_from_watchlist(user_id, ticker)
        await update.message.reply_text(f"{ticker} dihapus dari watchlist Anda.")

    except Exception as e:
        logger.error(safe_log(f"Error in unwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal menghapus dari watchlist")

async def listwatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List watchlist"""
    try:
        user_id = update.effective_user.id
        from db_utils import get_watchlist
        watchlist = await get_watchlist(user_id)

        if not watchlist:
            await update.message.reply_text("Watchlist Anda kosong.")
            return

        message = "📋 *Daftar saham yang Anda pantau:*\n\n"
        for i, ticker in enumerate(watchlist, 1):
            message += f"{i}. {ticker}\n"

        await update.message.reply_text(message, parse_mode="Markdown")

    except Exception as e:
        logger.error(safe_log(f"Error in listwatch: {str(e)}"))
        await show_error_message(update, context, "Gagal mengambil watchlist")

# Premium features
async def technical_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Technical analysis (premium feature)"""
    await show_premium_required_message(update, context)

async def predict_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Stock prediction (premium feature)"""
    await show_premium_required_message(update, context)

async def fundamental(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fundamental analysis (premium feature)"""
    await show_premium_required_message(update, context)

async def signal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trading signals (premium feature)"""
    await show_premium_required_message(update, context)

async def volatility(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Volatility analysis (premium feature)"""
    await show_premium_required_message(update, context)

async def value_investing_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Value investing analysis (premium feature)"""
    await show_premium_required_message(update, context)

# Export all functions
__all__ = [
    'check_stock', 'top_gainers', 'top_losers', 'top_crypto', 'global_indices',
    'commodity_prices', 'major_currencies', 'watch', 'unwatch', 'listwatch',
    'technical_analysis', 'predict_stock', 'fundamental', 'signal',
    'volatility', 'value_investing_analysis'
]