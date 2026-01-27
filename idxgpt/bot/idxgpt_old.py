import asyncio
import logging
import re
import io
import os
import requests
import psycopg2
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
from bs4 import BeautifulSoup
from aiogram import Bot, Dispatcher, Router
from aiogram.types import Message, BufferedInputFile
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from openai import OpenAI
import sys

# =========================================================
# CONFIG & LOGGING
# =========================================================
BOT_TOKEN = "8126172680:AAFcGbz4M0UGWt7L-UpQOqi-hdUPA4tQ_Us"
OPENROUTER_API_KEY = "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"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1"
HF_API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-1B-Instruct"
HF_API_KEY = "YOUR_HUGGINGFACE_KEY"  # biarkan default jika tidak pakai fallback

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("bot.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# =========================================================
# DATABASE
# =========================================================
db_config = {
    "dbname": "stock",
    "user": "openpg",
    "password": "openpgpwd",
    "host": "localhost",
    "port": "5432"
}
engine = create_engine(
    f"postgresql+psycopg2://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['dbname']}"
)

# =========================================================
# OPENROUTER CLIENT
# =========================================================
openrouter_client = OpenAI(base_url=OPENROUTER_API_URL, api_key=OPENROUTER_API_KEY)

# =========================================================
# ROUTER & STATE
# =========================================================
router = Router()

class ChatState(StatesGroup):
    chatting = State()

# =========================================================
# NORMALISASI KODE
# =========================================================
def normalize_symbol(kode: str, market: str) -> str:
    """
    Normalisasi kode saham untuk disesuaikan dengan format DB.
    IDX → tambahkan .JK jika belum ada.
    US  → biarkan sesuai input.
    """
    kode = (kode or "").upper().strip()
    m = (market or "").lower().strip()
    if m == "idx" and not kode.endswith(".JK"):
        return f"{kode}.JK"
    return kode

# =========================================================
# SENDER AMAN (ANTI ENTITY / TERPOTONG)
# =========================================================
def _sanitize_text(text: str) -> str:
    if not text:
        return ""
    # Hapus kontrol non-printable (kecuali \n \t)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch for ch in text if ch in ("\n", "\t") or ord(ch) >= 32)
    # Hindari baris super panjang
    out_lines = []
    for ln in text.split("\n"):
        while len(ln) > 2000:
            out_lines.append(ln[:2000])
            ln = ln[2000:]
        out_lines.append(ln)
    return "\n".join(out_lines)

def _chunk_text(text: str, max_len: int = 3800):
    text = _sanitize_text(text)
    if len(text) <= max_len:
        return [text]
    parts, cur = [], ""
    for line in text.split("\n"):
        if len(cur) + len(line) + 1 <= max_len:
            cur += line + "\n"
        else:
            if cur:
                parts.append(cur.rstrip("\n"))
            # jika line sangat panjang, pecah paksa
            while len(line) > max_len:
                parts.append(line[:max_len])
                line = line[max_len:]
            cur = line + "\n"
    if cur:
        parts.append(cur.rstrip("\n"))
    return parts

async def send_text_safe(message: Message, text: str):
    """
    Kirim plain text (tanpa parse_mode), dipotong aman.
    """
    for chunk in _chunk_text(text):
        await message.answer(chunk, disable_web_page_preview=True)
        await asyncio.sleep(0.15)

async def send_chunked_or_file(message: Message, title: str, text: str, hard_limit: int = 30000):
    """
    Jika teks > hard_limit → kirim ringkasan + attach file .txt lengkap.
    Jika tidak → kirim chunked aman.
    """
    safe = _sanitize_text(text)
    if len(safe) <= hard_limit:
        await send_text_safe(message, safe)
        return

    # Ringkas yang dikirim di chat
    head = safe[:4000]
    tail_note = f"\n\n[Konten panjang dipotong. File lengkap dilampirkan.]"
    await send_text_safe(message, head + tail_note)

    # Kirim file txt lengkap
    b = io.BytesIO(safe.encode("utf-8"))
    b.seek(0)
    filename = re.sub(r"[^A-Za-z0-9_\-\.]", "_", f"{title or 'output'}.txt")
    await message.answer_document(BufferedInputFile(b.getvalue(), filename))

# =========================================================
# DATA HELPERS
# =========================================================
def get_fundamental_history(symbol: str, market: str) -> pd.DataFrame:
    query = """
        SELECT report_date, eps, per, pbv, roe, dividend_yield
        FROM fundamental_data
        WHERE symbol = %s AND market = %s
        ORDER BY report_date ASC;
    """
    return pd.read_sql(query, engine, params=(symbol, market))

def plot_fundamental(df: pd.DataFrame, symbol: str) -> io.BytesIO:
    fig, axes = plt.subplots(2, 2, figsize=(10, 7))
    fig.suptitle(f"Tren Fundamental {symbol}", fontsize=14)

    axes[0, 0].plot(df["report_date"], df["eps"], marker="o"); axes[0, 0].set_title("EPS")
    axes[0, 1].plot(df["report_date"], df["per"], marker="o"); axes[0, 1].set_title("PER")
    axes[1, 0].plot(df["report_date"], df["pbv"], marker="o"); axes[1, 0].set_title("PBV")
    axes[1, 1].plot(df["report_date"], df["dividend_yield"], marker="o"); axes[1, 1].set_title("Dividend Yield")

    for ax in axes.flatten():
        ax.tick_params(axis="x", rotation=45)

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    buf.seek(0)
    plt.close(fig)
    return buf

# =========================================================
# AI HELPER
# =========================================================
async def ask_ai(prompt: str, max_tokens: int = 600) -> str:
    try:
        completion = openrouter_client.chat.completions.create(
            model="deepseek/deepseek-chat-v3.1:free",
            messages=[{"role": "user", "content": _sanitize_text(prompt)}],
            max_tokens=max_tokens,
            temperature=0.7
        )
        content = completion.choices[0].message.content
        return _sanitize_text(content or "Tidak ada respons dari model.")
    except Exception as e:
        logger.warning(f"OpenRouter gagal: {e}")
        if not HF_API_KEY or HF_API_KEY == "YOUR_HUGGINGFACE_KEY":
            return f"[Gagal memanggil model] {e}"
        try:
            headers = {"Authorization": f"Bearer {HF_API_KEY}"}
            payload = {"inputs": prompt, "parameters": {"max_length": max_tokens, "temperature": 0.7}}
            r = requests.post(HF_API_URL, headers=headers, json=payload, timeout=25)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, list) and data and "generated_text" in data[0]:
                return _sanitize_text(data[0]["generated_text"])
            return _sanitize_text(str(data))
        except Exception as e2:
            return _sanitize_text(f"[Gagal fallback HF] {e2}")

# =========================================================
# FORMATTER
# =========================================================
def fmt_num(x):
    if x is None:
        return "-"
    try:
        xf = float(x)
        if abs(xf) < 1:
            return f"{xf:.4f}"
        return f"{xf:.2f}"
    except Exception:
        return str(x)

# =========================================================
# COMMAND HANDLERS
# =========================================================
@router.message(Command("start"))
async def cmd_start(message: Message):
    text = (
        "Selamat datang di SahamGPT Bot!\n\n"
        "Perintah:\n"
        "/chat <KODE> <pertanyaan>\n"
        "/fundamental <KODE> <idx/us>\n"
        "/trend <KODE> <idx/us>\n"
        "/analisa <KODE> <idx/us> [pertanyaan]\n\n"
        "Contoh:\n"
        "/chat BBCA prediksi harga besok\n"
        "/fundamental TLKM idx\n"
        "/analisa BBRI idx peluang minggu depan"
    )
    await send_text_safe(message, text)

@router.message(Command("chat"))
async def cmd_chat(message: Message, state: FSMContext = None):
    # /chat <KODE> <pertanyaan...>
    parts = message.text.split(maxsplit=2)
    if len(parts) < 2:
        await send_text_safe(message, "Gunakan: /chat <KODE_SAHAM> <pertanyaan>")
        return

    kode = parts[1].upper()
    pertanyaan = parts[2] if len(parts) > 2 else "Prediksi tren saham"

    if not re.fullmatch(r"[A-Z]{4}", kode):
        await send_text_safe(message, "Kode saham harus 4 huruf kapital, contoh: BBCA")
        return

    loading = await message.answer("Sedang analisa data...")

    # ambil teknikal dari saham_data (kolom biasanya tanpa .JK)
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            SELECT "Tanggal Perdagangan Terakhir", "Penutupan", "Volume", "Tertinggi", "Terendah"
            FROM saham_data
            WHERE "Kode Saham"=%s
            ORDER BY "Tanggal Perdagangan Terakhir" DESC
            LIMIT 90;
        """, (kode,))
        rows = cur.fetchall()
    except Exception as e:
        await loading.edit_text("Gagal akses database.")
        await send_text_safe(message, f"Error DB: {e}")
        return
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

    if not rows:
        await loading.edit_text(f"Tidak ada data untuk {kode}")
        return

    data_hist = "\n".join([f"{r[0]}: Close={r[1]}, Vol={r[2]}, High={r[3]}, Low={r[4]}" for r in rows])

    prompt = (
        f"Anda analis saham. Analisa {kode} berdasarkan data berikut (90 baris terakhir):\n"
        f"{data_hist}\n\n"
        f"Pertanyaan: {pertanyaan}\n"
        f"Jawab ringkas dan jelas."
    )
    ai_resp = await ask_ai(prompt)
    try:
        await loading.delete()
    except Exception:
        pass
    await send_chunked_or_file(message, f"Chat_{kode}", f"Prediksi AI untuk {kode}:\n\n{ai_resp}")

@router.message(Command("fundamental"))
async def cmd_fundamental(message: Message):
    # /fundamental <KODE> <idx/us>
    parts = message.text.split()
    if len(parts) < 3:
        await send_text_safe(message, "Gunakan: /fundamental <KODE_SAHAM> <idx/us>")
        return

    kode_input, market = parts[1].upper(), parts[2].lower()
    kode_db = normalize_symbol(kode_input, market)

    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            SELECT report_date, eps, per, pbv, roe, dividend_yield
            FROM fundamental_data
            WHERE symbol=%s AND market=%s
            ORDER BY report_date DESC
            LIMIT 6;
        """, (kode_db, market))
        rows = cur.fetchall()
    except Exception as e:
        await send_text_safe(message, f"Error DB: {e}")
        return
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

    if not rows:
        await send_text_safe(message, f"Tidak ada data fundamental {kode_input} ({market})")
        return

    lines = []
    for r in rows:
        d = r[0].strftime("%Y-%m-%d") if hasattr(r[0], "strftime") else str(r[0])
        lines.append(
            f"{d}: EPS={fmt_num(r[1])}, PER={fmt_num(r[2])}, PBV={fmt_num(r[3])}, ROE={fmt_num(r[4])}, DY={fmt_num(r[5])}"
        )
    summary = "\n".join(lines)

    header = f"Data fundamental {kode_input} ({market.upper()}):\n\n{summary}"
    await send_chunked_or_file(message, f"Fundamental_{kode_input}", header)

    prompt = (
        f"Analisa fundamental {kode_input} ({market.upper()}) berdasarkan data berikut:\n"
        f"{summary}\n\n"
        f"Berikan kesimpulan valuasi (PER/PBV), profitabilitas (EPS/ROE), dividen (DY), dan rekomendasi."
    )
    ai_resp = await ask_ai(prompt)
    await send_chunked_or_file(message, f"Analisa_Fundamental_{kode_input}", f"Analisa Fundamental AI:\n\n{ai_resp}")

@router.message(Command("trend"))
async def cmd_trend(message: Message):
    # /trend <KODE> <idx/us>
    parts = message.text.split()
    if len(parts) < 3:
        await send_text_safe(message, "Gunakan: /trend <KODE_SAHAM> <idx/us>")
        return

    kode_input, market = parts[1].upper(), parts[2].lower()
    kode_db = normalize_symbol(kode_input, market)

    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            SELECT report_date, eps, per, pbv, roe, dividend_yield
            FROM fundamental_data
            WHERE symbol=%s AND market=%s
            ORDER BY report_date ASC;
        """, (kode_db, market))
        rows = cur.fetchall()
    except Exception as e:
        await send_text_safe(message, f"Error DB: {e}")
        return
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

    if not rows:
        await send_text_safe(message, f"Tidak ada data fundamental {kode_input} ({market})")
        return

    df = pd.DataFrame(rows, columns=["report_date", "eps", "per", "pbv", "roe", "dividend_yield"])
    buf = plot_fundamental(df, kode_input)
    caption = f"Tren fundamental {kode_input} ({market.upper()})"
    await message.answer_photo(BufferedInputFile(buf.getvalue(), f"{kode_input}_trend.png"), caption=caption)

@router.message(Command("analisa"))
async def cmd_analisa(message: Message):
    # /analisa <KODE> <idx/us> [pertanyaan...]
    parts = message.text.split(maxsplit=3)
    if len(parts) < 3:
        await send_text_safe(message, "Gunakan: /analisa <KODE_SAHAM> <idx/us> [pertanyaan]")
        return

    kode_input = parts[1].upper()
    market = parts[2].lower()
    pertanyaan = parts[3] if len(parts) > 3 else "Prediksi tren saham"
    kode_db = normalize_symbol(kode_input, market)

    loading = await message.answer("⏳ Menggabungkan analisa teknikal, fundamental, dan berita...")

    # === Data teknikal (dari saham_data) ===
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            SELECT "Tanggal Perdagangan Terakhir", "Penutupan", "Volume", "Tertinggi", "Terendah"
            FROM saham_data
            WHERE "Kode Saham"=%s
            ORDER BY "Tanggal Perdagangan Terakhir" DESC
            LIMIT 90;
        """, (kode_db,))
        teknikal = cur.fetchall()
    except Exception as e:
        await loading.edit_text("⚠️ Gagal akses database (teknikal).")
        await send_text_safe(message, f"Error DB teknikal: {e}")
        return
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

    data_teknikal = (
        "\n".join([f"{r[0]}: Close={r[1]}, Vol={r[2]}, High={r[3]}, Low={r[4]}"
                   for r in teknikal]) if teknikal else "Tidak ada data teknikal."
    )

    # === Data fundamental (dari fundamental_data) ===
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            SELECT report_date, eps, per, pbv, roe, dividend_yield
            FROM fundamental_data
            WHERE symbol=%s AND market=%s
            ORDER BY report_date DESC
            LIMIT 5;
        """, (kode_db, market))
        fundamental = cur.fetchall()
    except Exception as e:
        await loading.edit_text("⚠️ Gagal akses database (fundamental).")
        await send_text_safe(message, f"Error DB fundamental: {e}")
        return
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

    data_fund = (
        "\n".join([
            f"{r[0]}: EPS={fmt_num(r[1])}, PER={fmt_num(r[2])}, PBV={fmt_num(r[3])}, ROE={fmt_num(r[4])}, DY={fmt_num(r[5])}"
            for r in fundamental
        ]) if fundamental else "Tidak ada data fundamental."
    )

    # === Berita terbaru (ringkas & aman panjang) ===
    berita_summary = "Tidak ada berita."
    try:
        url = f"https://www.cnbcindonesia.com/search?query={kode_input}+saham"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=12)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")
        articles = soup.find_all("article", limit=3)
        collected = []
        for a in articles:
            text = a.get_text(" ", strip=True)
            if text:
                collected.append(_sanitize_text(text)[:500])
        berita_summary = "\n\n".join(collected) if collected else "Tidak ada berita terbaru."
    except Exception as e:
        logger.warning(f"Gagal ambil berita: {e}")
        berita_summary = "⚠️ Gagal mengambil berita."

    # === Prompt AI ===
    prompt = (
        f"Analisa mendalam saham {kode_input} ({market.upper()}).\n\n"
        f"Data teknikal (90 hari):\n{data_teknikal}\n\n"
        f"Data fundamental (5 laporan terakhir):\n{data_fund}\n\n"
        f"Berita terbaru:\n{berita_summary}\n\n"
        f"Pertanyaan pengguna: {pertanyaan}\n\n"
        f"Berikan analisa teknikal, fundamental, sentimen berita, serta rekomendasi beli/jual/tahan secara ringkas dan jelas."
    )

    ai_resp = await ask_ai(prompt, max_tokens=900)

    try:
        await loading.delete()
    except Exception:
        pass

    await send_chunked_or_file(message, f"Analisa_{kode_input}", f"Analisa Mendalam AI untuk {kode_input}:\n\n{ai_resp}")

@router.message(Command("teknikal"))
async def cmd_teknikal(message: Message):
    args = message.text.split()[1:]
    if len(args) < 2:
        await message.answer("Gunakan: /teknikal <kode_saham> <market: idx/us>")
        return

    kode_saham, market = args[0].upper(), args[1].lower()
    table = "idx_data" if market == "idx" else "usa_data"

    try:
        # --- Ambil data historis ---
        query = f"""
            SELECT trade_date, close, high, low, volume
            FROM {table}
            WHERE symbol = %s
            ORDER BY trade_date DESC
            LIMIT 150;
        """
        df = pd.read_sql(query, engine, params=(kode_saham,))
        if df.empty:
            await message.answer(f"Tidak ada data teknikal untuk {kode_saham} di {market.upper()}")
            return

        df = df.sort_values("trade_date")  # urutkan ascending

        # --- Hitung indikator teknikal ---
        df["MA20"] = df["close"].rolling(window=20).mean()
        df["MA50"] = df["close"].rolling(window=50).mean()

        # RSI 14
        delta = df["close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        df["RSI"] = 100 - (100 / (1 + rs))

        # --- Plot harga + MA ---
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True, gridspec_kw={'height_ratios': [3, 1]})
        
        ax1.plot(df["trade_date"], df["close"], label="Close", color="blue")
        ax1.plot(df["trade_date"], df["MA20"], label="MA20", color="orange", linestyle="--")
        ax1.plot(df["trade_date"], df["MA50"], label="MA50", color="green", linestyle="--")
        ax1.set_title(f"Teknikal {kode_saham} ({market.upper()})")
        ax1.legend()
        ax1.grid(True)

        # --- Plot RSI ---
        ax2.plot(df["trade_date"], df["RSI"], label="RSI(14)", color="red")
        ax2.axhline(70, color="gray", linestyle="--", linewidth=1)
        ax2.axhline(30, color="gray", linestyle="--", linewidth=1)
        ax2.set_title("RSI(14)")
        ax2.legend()
        ax2.grid(True)

        plt.xticks(rotation=45)
        plt.tight_layout()

        # --- Simpan ke buffer ---
        buf = io.BytesIO()
        plt.savefig(buf, format="png")
        buf.seek(0)
        plt.close(fig)

        # --- Kirim ke Telegram ---
        image_file = BufferedInputFile(buf.getvalue(), filename="teknikal.png")
        await message.answer_photo(image_file, caption=f"📊 Analisa teknikal {kode_saham} ({market.upper()})")

    except Exception as e:
        await message.answer(f"Terjadi kesalahan saat analisa teknikal: {e}")

# =========================================================
# MAIN
# =========================================================
async def main():
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    logger.info("Bot dimulai...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python idxgpt.py <command> <kode> [market]")
        sys.exit(1)

    command = sys.argv[1]
    kode = sys.argv[2]
    market = sys.argv[3] if len(sys.argv) > 3 else "idx"

    # Jalankan fungsi sesuai command
    if command == "fundamental":
        print(f"[FUNDAMENTAL] Analisa saham {kode} di market {market}")
    elif command == "analisa":
        print(f"[ANALISA] Analisa saham {kode}")
    elif command == "teknikal":
        print(f"[TEKNIKAL] Chart dan indikator {kode}")
    elif command == "berita":
        print(f"[BERITA] Berita terbaru {kode}")
    else:
        print("Command tidak dikenali")

