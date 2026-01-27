import asyncio
import os
import logging
import tempfile
from aiogram import Bot, Dispatcher, Router
from aiogram.types import Message, FSInputFile
from aiogram.filters import Command, CommandStart
import psycopg2
from psycopg2 import sql
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.dates import DateFormatter

# Konfigurasi logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Konfigurasi koneksi PostgreSQL
db_config = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# Token bot Telegram
BOT_TOKEN = "6194293517:AAHXX-cJFjXOlQ6KN3gfl1OBRFhKFljr_jo"

# Fungsi untuk memformat nilai ke M, B, atau T
def format_value(value):
    if value is None:
        return "0"
    if isinstance(value, (int, float)):
        if value >= 1_000_000_000:  # Miliar
            return f"{value / 1_000_000_000:.2f} B"
        elif value >= 1_000_000:  # Juta
            return f"{value / 1_000_000:.2f} M"
        elif value >= 1_000:  # Ribu
            return f"{value / 1_000:.2f} K"
        else:
            return f"{value:.2f}"
    return str(value)

def create_table_image(data, title, is_gainer=True, is_accum=False, is_index=False, is_macd=False, is_period=False):
    # Dimensi dan pengaturan tabel
    if is_accum or is_macd:
        cell_widths = [120, 350, 160, 140, 160, 160, 160]  # Adjusted for longer text
    elif is_period:
        cell_widths = [120, 350, 160, 140, 140, 160, 160]
    else:
        cell_widths = [120, 350, 160, 140, 160, 160]
    cell_height = 35
    header_height = 40
    font_size = 14  # Reduced from 16 to fit more content
    footer_height = 30  # Space for footer label
    font_path = "arial.ttf"
    max_rows_per_image = 30
    try:
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()
        logger.warning("Font arial.ttf tidak ditemukan, menggunakan font default")

    image_files = []
    for chunk_start in range(0, len(data), max_rows_per_image):
        chunk = data[chunk_start:chunk_start + max_rows_per_image]
        
        # Hitung dimensi gambar
        width = sum(cell_widths)
        height = header_height + len(chunk) * cell_height + footer_height + 40
        image = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(image)

        # Gambar judul
        draw.text((10, 10), f"{title} (Bagian {chunk_start // max_rows_per_image + 1})", fill='black', font=font)

        # Gambar header tabel
        if is_period:
            headers = ["Ticker", "Company Name", "Change (%)", "Close", "Open", "Volume", "Value (Rp)"]
        elif is_accum:
            headers = ["Ticker", "Company Name", "Net Foreign (Rp)", "Foreign Buy", "Foreign Sell", "Volume", "Value (Rp)"]
        elif is_index:
            headers = ["Index", "Index Name", "Change (%)", "Close", "Volume", "Value (Rp)"]
        elif is_macd:
            headers = ["Ticker", "Company Name", "Change (%)", "Close", "Cross Type", "Volume", "Value (Rp)"]
        else:
            headers = ["Ticker", "Company Name", "Change (%)", "Close", "Volume", "Value (Rp)"]
        y = 30
        x = 0
        for i, header in enumerate(headers):
            draw.rectangle([(x, y), (x + cell_widths[i], y + header_height)], outline='black', fill='lightgray')
            draw.text((x + 5, y + 10), header, fill='black', font=font)
            x += cell_widths[i]

        # Gambar baris data
        y += header_height
        for row in chunk:
            if is_period:
                kode_saham, nama_perusahaan, persentase, penutupan, open_price, volume, nilai = row
                row_data = [
                    kode_saham,
                    nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan,
                    f"{persentase:.2f}%" if isinstance(persentase, (int, float)) else persentase,
                    f"{penutupan:.2f}" if isinstance(penutupan, (int, float)) else penutupan,
                    f"{open_price:.2f}" if isinstance(open_price, (int, float)) else open_price,
                    f"{volume:,}" if isinstance(volume, (int, float)) else volume,
                    format_value(nilai)
                ]
            elif is_accum:
                kode_saham, nama_perusahaan, net_foreign, foreign_buy, foreign_sell, volume, nilai = row
                row_data = [
                    kode_saham,
                    nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan,
                    format_value(net_foreign),
                    format_value(foreign_buy),
                    format_value(foreign_sell),
                    f"{volume:,}",
                    format_value(nilai)
                ]
            elif is_macd:
                kode_saham, nama_perusahaan, persentase, penutupan, cross_type, volume, nilai = row
                row_data = [
                    kode_saham,
                    nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan,
                    f"{persentase:.2f}%" if isinstance(persentase, (int, float)) else persentase,
                    f"{penutupan:.2f}" if isinstance(penutupan, (int, float)) else penutupan,
                    cross_type,
                    f"{volume:,}" if isinstance(volume, (int, float)) else volume,
                    format_value(nilai)
                ]
            else:
                kode_saham, nama_perusahaan, persentase, penutupan, volume, nilai = row
                row_data = [
                    kode_saham,
                    nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan,
                    f"{persentase:.2f}%" if isinstance(persentase, (int, float)) else persentase,
                    f"{penutupan:.2f}" if isinstance(penutupan, (int, float)) else penutupan,
                    f"{volume:,}" if isinstance(volume, (int, float)) else volume,
                    format_value(nilai)
                ]
            x = 0
            for i, cell in enumerate(row_data):
                if is_period and i == 2:  # Kolom Change (%)
                    fill_color = 'lightgreen' if (is_gainer and persentase > 0) else 'salmon' if (not is_gainer and persentase < 0) else 'white'
                elif is_macd and i == 4:  # Kolom Cross Type
                    fill_color = 'lightgreen' if cell == 'Bullish' else 'salmon' if cell == 'Bearish' else 'white'
                elif is_accum and i == 2:  # Kolom Net Foreign
                    fill_color = 'lightgreen' if 'Accum' in title else 'salmon' if 'Sell' in title else 'white'
                else:
                    fill_color = 'white'
                draw.rectangle([(x, y), (x + cell_widths[i], y + cell_height)], outline='black', fill=fill_color)
                draw.text((x + 5, y + 10), str(cell), fill='black', font=font)
                x += cell_widths[i]
            y += cell_height

        # Tambahkan label footer
        draw.text((10, y + 10), "Created by love with bisnis-it.com", fill='black', font=font)

        # Simpan gambar ke file sementara
        with tempfile.NamedTemporaryFile(suffix=f"_part_{chunk_start // max_rows_per_image + 1}.png", delete=False) as temp_file:
            temp_file_path = temp_file.name
            image.save(temp_file_path, format="PNG")
            if os.path.exists(temp_file_path):
                image_files.append(temp_file_path)
                logger.info(f"Gambar sementara {temp_file_path} dibuat untuk {len(chunk)} baris")
            else:
                logger.error(f"Gagal membuat gambar sementara {temp_file_path}")
                raise FileNotFoundError(f"Gagal membuat gambar sementara {temp_file_path}")

    return image_files

# Inisialisasi router untuk handler
router = Router()

# Handler untuk perintah /start
@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    first_name = message.from_user.first_name
    last_name = message.from_user.last_name or ""
    user_id = message.from_user.id
    logger.info(f"Perintah /start diterima dari user_id: {user_id}, nama: {first_name} {last_name}")
    await message.answer(f"Halo, {first_name} {last_name}! Selamat datang di Bot Saham.\n"
                        f"Gunakan /help untuk melihat daftar perintah.")

# Handler untuk perintah /help
@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    user_id = message.from_user.id
    logger.info(f"Perintah /help diterima dari user_id: {user_id}")
    help_text = (
        "Panduan penggunaan Bot Saham:\n"
        "/start - Memulai bot\n"
        "/help - Menampilkan panduan ini\n"
        "/getdata [Kode Saham] [Tanggal] - Mengambil data saham\n"
        "  Contoh: /getdata BBCA 2025-08-14 atau /getdata BBCA\n"
        "/tg [yyyy-mm-dd] - Menampilkan Top 30 Gainers untuk tanggal tertentu\n"
        "  Contoh: /tg 2025-08-14 atau /tg\n"
        "/tl [yyyy-mm-dd] - Menampilkan Top 30 Losers untuk tanggal tertentu\n"
        "  Contoh: /tl 2025-08-14 atau /tl\n"
        "/fa [yyyy-mm-dd] - Menampilkan semua Top Foreign Accumulation untuk tanggal tertentu\n"
        "  Contoh: /fa 2025-08-14 atau /fa\n"
        "/fs [yyyy-mm-dd] - Menampilkan semua Top Foreign Sell untuk tanggal tertentu\n"
        "  Contoh: /fs 2025-08-14 atau /fs\n"
        "/index [yyyy-mm-dd] - Menampilkan kenaikan/penurunan indeks untuk tanggal tertentu\n"
        "  Contoh: /index 2025-08-14 atau /index\n"
        "/topvolume [yyyy-mm-dd] - Menampilkan Top 30 saham berdasarkan volume untuk tanggal tertentu\n"
        "  Contoh: /topvolume 2025-08-14 atau /topvolume\n"
        "/topvalue [yyyy-mm-dd] - Menampilkan Top 30 saham berdasarkan nilai perdagangan untuk tanggal tertentu\n"
        "  Contoh: /topvalue 2025-08-14 atau /topvalue\n"
        "/macdcross [yyyy-mm-dd] - Menampilkan saham dengan MACD Crossover untuk tanggal tertentu\n"
        "  Contoh: /macdcross 2025-08-14 atau /macdcross\n"
        "/mash [yyyy-mm-dd] - Menampilkan saham dengan MACD Bullish Crossover dan Stochastic Oversold\n"
        "  Contoh: /mash 2025-08-14 atau /mash\n"
        "/stoch [yyyy-mm-dd] - Menampilkan saham dengan Stochastic Oversold\n"
        "  Contoh: /stoch 2025-08-14 atau /stoch\n"
        "/stochg [yyyy-mm-dd] [Kode Saham] - Menampilkan grafik Stochastic untuk saham tertentu\n"
        "  Contoh: /stochg 2025-08-14 BBCA atau /stochg BBCA"
    )
    await message.answer(help_text)

# Handler untuk perintah /getdata
@router.message(Command("getdata"))
async def cmd_getdata(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /getdata diterima dari user_id: {user_id}, argumen: {args}")
    
    if not args:
        logger.warning(f"Argumen kosong untuk /getdata dari user_id: {user_id}")
        await message.answer("Silakan masukkan Kode Saham. Contoh: /getdata BBCA atau /getdata BBCA 2025-08-14")
        return

    kode_saham = args[0].upper()
    tanggal = args[1] if len(args) > 1 else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /getdata: {kode_saham}, {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT * FROM {table}
            WHERE "Kode Saham" = %s AND "Tanggal Perdagangan Terakhir" = %s
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (kode_saham, tanggal))
        else:
            query = sql.SQL('''
            SELECT * FROM {table}
            WHERE "Kode Saham" = %s
            ORDER BY "Tanggal Perdagangan Terakhir" DESC
            LIMIT 1
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (kode_saham,))

        result = cur.fetchone()
        if result:
            columns = [desc[0] for desc in cur.description]
            data = dict(zip(columns, result))
            response = (
                f"Data Saham untuk {kode_saham}:\n"
                f"Tanggal Perdagangan: {data['Tanggal Perdagangan Terakhir']}\n"
                f"Nama Perusahaan: {data['Nama Perusahaan']}\n"
                f"Penutupan: {data['Penutupan']}\n"
                f"Volume: {data['Volume']}\n"
                f"Nilai: {format_value(data['Nilai'])}\n"
                f"Frekuensi: {data['Frekuensi']}\n"
                f"Tertinggi: {data['Tertinggi']}\n"
                f"Terendah: {data['Terendah']}"
            )
            logger.info(f"Data ditemukan untuk Kode Saham: {kode_saham}, Tanggal: {tanggal or 'terbaru'}")
            await message.answer(response)
        else:
            logger.warning(f"Tidak ditemukan data untuk Kode Saham: {kode_saham}, Tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan data untuk Kode Saham '{kode_saham}'"
                                f"{'' if not tanggal else f' pada tanggal {tanggal}'}.")
    except Exception as e:
        logger.error(f"Error saat mengambil data: {e}")
        await message.answer(f"Error saat mengambil data: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /tg
@router.message(Command("tg"))
async def cmd_top_gainers(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /tg diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = None
    jumlah_hari = None
    
    if len(args) == 1:
        try:
            jumlah_hari = int(args[0])
            if jumlah_hari <= 0:
                raise ValueError("Jumlah hari harus lebih dari 0")
        except ValueError:
            try:
                datetime.strptime(args[0], '%Y-%m-%d')
                tanggal = args[0]
                jumlah_hari = 1
            except ValueError:
                logger.error(f"Argumen tidak valid: {args[0]} dari user_id: {user_id}")
                await message.answer("Argumen tidak valid. Gunakan /tg [yyyy-mm-dd] atau /tg <jumlah_hari>, misalnya: /tg 2025-08-14 atau /tg 100")
                return
    elif len(args) == 2:
        try:
            datetime.strptime(args[0], '%Y-%m-%d')
            tanggal = args[0]
            jumlah_hari = int(args[1])
            if jumlah_hari <= 0:
                raise ValueError("Jumlah hari harus lebih dari 0")
        except ValueError:
            logger.error(f"Argumen tidak valid: {args} dari user_id: {user_id}")
            await message.answer("Argumen tidak valid. Gunakan /tg yyyy-mm-dd <jumlah_hari>, misalnya: /tg 2025-08-14 100")
            return
    else:
        jumlah_hari = 1

    try:
        logger.info(f"Membuka koneksi database untuk query /tg: tanggal={tanggal}, jumlah_hari={jumlah_hari}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if not tanggal:
            query = sql.SQL('SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}').format(table=sql.Identifier('saham_data'))
            cur.execute(query)
            max_date = cur.fetchone()[0]
            tanggal = max_date.strftime('%Y-%m-%d') if max_date else datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Tanggal terbaru dari database: {tanggal}")

        tanggal_akhir = datetime.strptime(tanggal, '%Y-%m-%d')
        tanggal_awal = tanggal_akhir - timedelta(days=jumlah_hari)
        tanggal_awal_str = tanggal_awal.strftime('%Y-%m-%d')
        logger.info(f"Menghitung Top Gainers dari {tanggal_awal_str} hingga {tanggal}")

        query = sql.SQL('''
        SELECT s."Kode Saham", s."Nama Perusahaan", s."Penutupan", s."Volume", s."Nilai",
               COALESCE(
                   s."Open Price",
                   (SELECT "Penutupan" FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" < %s ORDER BY "Tanggal Perdagangan Terakhir" DESC LIMIT 1)
               ) AS open_price,
               (SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                   SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
               )) AS penutupan_awal
        FROM {table} s
        WHERE s."Tanggal Perdagangan Terakhir" = %s
        AND EXISTS (
            SELECT 1 FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" <= %s
            AND awal."Penutupan" IS NOT NULL AND awal."Penutupan" > 0
            AND s."Penutupan" > awal."Penutupan"
        )
        ORDER BY ((s."Penutupan" - (
            SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
            )
        )) / (
            SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
            )
        ) * 100) DESC
        LIMIT 30
        ''').format(table=sql.Identifier('saham_data'))
        cur.execute(query, (tanggal_akhir, tanggal_awal_str, tanggal, tanggal_awal_str, tanggal_awal_str, tanggal_awal_str))

        results = cur.fetchall()
        if results:
            periode = f"{jumlah_hari} hari" if jumlah_hari > 1 else "harian"
            response = f"Top Gainers ({periode}) dari {tanggal_awal_str} hingga {tanggal}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Open       | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|------------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, volume, nilai, open_price, penutupan_awal = row
                persentase = ((penutupan - penutupan_awal) / penutupan_awal * 100) if penutupan_awal and penutupan_awal > 0 else 0
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_saham, nama_perusahaan, persentase, penutupan, open_price, volume, nilai))
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {open_price:>10.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Gainers ({periode}) dari {tanggal_awal_str} hingga {tanggal}"
            try:
                image_files = create_table_image(table_data, title, is_gainer=True, is_period=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"top_gainers_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Gainers ({periode}) ditemukan untuk tanggal: {tanggal}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Gainers ({periode}) untuk tanggal: {tanggal}")
            await message.answer(f"Tidak ditemukan Top Gainers ({periode}) untuk tanggal {tanggal}. Pastikan data tersedia untuk periode tersebut.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Gainers: {e}")
        await message.answer(f"Error saat mengambil Top Gainers: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /tl
@router.message(Command("tl"))
async def cmd_top_losers(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /tl diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = None
    jumlah_hari = None
    
    if len(args) == 1:
        try:
            jumlah_hari = int(args[0])
            if jumlah_hari <= 0:
                raise ValueError("Jumlah hari harus lebih dari 0")
        except ValueError:
            try:
                datetime.strptime(args[0], '%Y-%m-%d')
                tanggal = args[0]
                jumlah_hari = 1
            except ValueError:
                logger.error(f"Argumen tidak valid: {args[0]} dari user_id: {user_id}")
                await message.answer("Argumen tidak valid. Gunakan /tl [yyyy-mm-dd] atau /tl <jumlah_hari>, misalnya: /tl 2025-08-14 atau /tl 100")
                return
    elif len(args) == 2:
        try:
            datetime.strptime(args[0], '%Y-%m-%d')
            tanggal = args[0]
            jumlah_hari = int(args[1])
            if jumlah_hari <= 0:
                raise ValueError("Jumlah hari harus lebih dari 0")
        except ValueError:
            logger.error(f"Argumen tidak valid: {args} dari user_id: {user_id}")
            await message.answer("Argumen tidak valid. Gunakan /tl yyyy-mm-dd <jumlah_hari>, misalnya: /tl 2025-08-14 100")
            return
    else:
        jumlah_hari = 1

    try:
        logger.info(f"Membuka koneksi database untuk query /tl: tanggal={tanggal}, jumlah_hari={jumlah_hari}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if not tanggal:
            query = sql.SQL('SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}').format(table=sql.Identifier('saham_data'))
            cur.execute(query)
            max_date = cur.fetchone()[0]
            tanggal = max_date.strftime('%Y-%m-%d') if max_date else datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Tanggal terbaru dari database: {tanggal}")

        tanggal_akhir = datetime.strptime(tanggal, '%Y-%m-%d')
        tanggal_awal = tanggal_akhir - timedelta(days=jumlah_hari)
        tanggal_awal_str = tanggal_awal.strftime('%Y-%m-%d')
        logger.info(f"Menghitung Top Losers dari {tanggal_awal_str} hingga {tanggal}")

        query = sql.SQL('''
        SELECT s."Kode Saham", s."Nama Perusahaan", s."Penutupan", s."Volume", s."Nilai",
               COALESCE(
                   s."Open Price",
                   (SELECT "Penutupan" FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" < %s ORDER BY "Tanggal Perdagangan Terakhir" DESC LIMIT 1)
               ) AS open_price,
               (SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                   SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
               )) AS penutupan_awal
        FROM {table} s
        WHERE s."Tanggal Perdagangan Terakhir" = %s
        AND EXISTS (
            SELECT 1 FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" <= %s
            AND awal."Penutupan" IS NOT NULL AND awal."Penutupan" > 0
            AND s."Penutupan" < awal."Penutupan"
        )
        ORDER BY ((s."Penutupan" - (
            SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
            )
        )) / (
            SELECT "Penutupan" FROM {table} awal WHERE awal."Kode Saham" = s."Kode Saham" AND awal."Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table} WHERE "Kode Saham" = s."Kode Saham" AND "Tanggal Perdagangan Terakhir" <= %s
            )
        ) * 100) ASC
        LIMIT 30
        ''').format(table=sql.Identifier('saham_data'))
        cur.execute(query, (tanggal_akhir, tanggal_awal_str, tanggal, tanggal_awal_str, tanggal_awal_str, tanggal_awal_str))

        results = cur.fetchall()
        if results:
            periode = f"{jumlah_hari} hari" if jumlah_hari > 1 else "harian"
            response = f"Top Losers ({periode}) dari {tanggal_awal_str} hingga {tanggal}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Open       | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|------------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, volume, nilai, open_price, penutupan_awal = row
                persentase = ((penutupan - penutupan_awal) / penutupan_awal * 100) if penutupan_awal and penutupan_awal > 0 else 0
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_saham, nama_perusahaan, persentase, penutupan, open_price, volume, nilai))
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {open_price:>10.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Losers ({periode}) dari {tanggal_awal_str} hingga {tanggal}"
            try:
                image_files = create_table_image(table_data, title, is_gainer=False, is_period=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"top_losers_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Losers ({periode}) ditemukan untuk tanggal: {tanggal}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Losers ({periode}) untuk tanggal: {tanggal}")
            await message.answer(f"Tidak ditemukan Top Losers ({periode}) untuk tanggal {tanggal}. Pastikan data tersedia untuk periode tersebut.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Losers: {e}")
        await message.answer(f"Error saat mengambil Top Losers: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /fa
@router.message(Command("fa"))
async def cmd_foreign_accumulation(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /fa diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /fa: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Net Foreign", "Foreign Buy", "Foreign Sell", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s AND "Net Foreign" > 0
            ORDER BY "Net Foreign" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Net Foreign", "Foreign Buy", "Foreign Sell", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            ) AND "Net Foreign" > 0
            ORDER BY "Net Foreign" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"Top Foreign Accumulation {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Net Foreign (Rp) | Foreign Buy | Foreign Sell | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|------------------|-------------|--------------|-------------|------------|\n"
            for row in results:
                kode_saham, nama_perusahaan, net_foreign, foreign_buy, foreign_sell, volume, nilai = row
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {format_value(net_foreign):>16} | {format_value(foreign_buy):>11} | {format_value(foreign_sell):>12} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Foreign Accumulation {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(results, title, is_accum=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"foreign_accum_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Foreign Accumulation ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Foreign Accumulation untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan Top Foreign Accumulation untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Foreign Accumulation: {e}")
        await message.answer(f"Error saat mengambil Top Foreign Accumulation: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /fs
@router.message(Command("fs"))
async def cmd_foreign_sell(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /fs diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /fs: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Net Foreign", "Foreign Buy", "Foreign Sell", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s AND "Net Foreign" < 0
            ORDER BY "Net Foreign" ASC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Net Foreign", "Foreign Buy", "Foreign Sell", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            ) AND "Net Foreign" < 0
            ORDER BY "Net Foreign" ASC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"Top Foreign Sell {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Net Foreign (Rp) | Foreign Buy | Foreign Sell | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|------------------|-------------|--------------|-------------|------------|\n"
            for row in results:
                kode_saham, nama_perusahaan, net_foreign, foreign_buy, foreign_sell, volume, nilai = row
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {format_value(net_foreign):>16} | {format_value(foreign_buy):>11} | {format_value(foreign_sell):>12} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Foreign Sell {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(results, title, is_accum=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"foreign_sell_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Foreign Sell ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Foreign Sell untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan Top Foreign Sell untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Foreign Sell: {e}")
        await message.answer(f"Error saat mengambil Top Foreign Sell: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /index
@router.message(Command("index"))
async def cmd_index(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /index diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /index: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Indeks", "Nama Indeks", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s
            ORDER BY "Selisih" / "Sebelumnya" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('index_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Indeks", "Nama Indeks", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            )
            ORDER BY "Selisih" / "Sebelumnya" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('index_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"Indeks {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Index | Index Name            | Change (%)    | Close     | Volume      | Value (Rp) |\n"
            response += "|-------|-----------------------|---------------|-----------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_indeks, nama_indeks, penutupan, selisih, sebelumnya, volume, nilai = row
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                nama_indeks = nama_indeks[:25] + "..." if len(nama_indeks) > 25 else nama_indeks
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_indeks, nama_indeks, persentase, penutupan, volume, nilai))
                response += (
                    f"| {kode_indeks:<5} | {nama_indeks:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Indeks {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(table_data, title, is_index=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"index_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Indeks ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan data Indeks untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan data Indeks untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil data Indeks: {e}")
        await message.answer(f"Error saat mengambil data Indeks: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /topvolume
@router.message(Command("topvolume"))
async def cmd_top_volume(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /topvolume diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /topvolume: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s
            ORDER BY "Volume" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            )
            ORDER BY "Volume" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"Top Volume (harian) {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai = row
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_saham, nama_perusahaan, persentase, penutupan, volume, nilai))
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Volume (harian) {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(table_data, title, is_gainer=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"top_volume_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Volume ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Volume untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan Top Volume untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Volume: {e}")
        await message.answer(f"Error saat mengambil Top Volume: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /topvalue
@router.message(Command("topvalue"))
async def cmd_top_value(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /topvalue diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /topvalue: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s
            ORDER BY "Nilai" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            )
            ORDER BY "Nilai" DESC
            LIMIT 30
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"Top Value (harian) {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai = row
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_saham, nama_perusahaan, persentase, penutupan, volume, nilai))
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"Top Value (harian) {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(table_data, title, is_gainer=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"top_value_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Top Value ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan Top Value untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan Top Value untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil Top Value: {e}")
        await message.answer(f"Error saat mengambil Top Value: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /macdcross
@router.message(Command("macdcross"))
async def cmd_macd_cross(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]
    logger.info(f"Perintah /macdcross diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /macdcross: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        if tanggal:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai", "Cross Type"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s AND "Cross Type" IS NOT NULL
            ORDER BY "Cross Type" ASC, "Penutupan" DESC
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query, (tanggal,))
        else:
            query = sql.SQL('''
            SELECT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai", "Cross Type"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            ) AND "Cross Type" IS NOT NULL
            ORDER BY "Cross Type" ASC, "Penutupan" DESC
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query)

        results = cur.fetchall()
        if results:
            response = f"MACD Crossover (harian) {'pada ' + tanggal if tanggal else 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Cross Type  | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|-------------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai, cross_type = row
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                table_data.append((kode_saham, nama_perusahaan, persentase, penutupan, cross_type, volume, nilai))
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {cross_type:<11} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            title = f"MACD Crossover (harian) {'pada ' + tanggal if tanggal else 'terbaru'}"
            try:
                image_files = create_table_image(table_data, title, is_macd=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"macd_cross_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            # Kirim teks sebagai cadangan
            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"MACD Crossover ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah baris: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan MACD Crossover untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(f"Tidak ditemukan MACD Crossover untuk tanggal {'terbaru' if not tanggal else tanggal}.")
    except Exception as e:
        logger.error(f"Error saat mengambil MACD Crossover: {e}")
        await message.answer(f"Error saat mengambil MACD Crossover: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /mash
@router.message(Command("mash"))
async def cmd_mash(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]  # Ambil argumen setelah /mash
    logger.info(f"Perintah /mash diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /mash: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        # Dapatkan list kode saham unik pada tanggal tersebut
        if tanggal:
            query_saham = sql.SQL('''
            SELECT DISTINCT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = %s
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query_saham, (tanggal,))
        else:
            query_saham = sql.SQL('''
            SELECT DISTINCT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
            FROM {table}
            WHERE "Tanggal Perdagangan Terakhir" = (
                SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}
            )
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query_saham)
        
        saham_list = cur.fetchall()
        logger.info(f"Memproses {len(saham_list)} saham untuk MACD Bullish Crossover dan Stochastic Oversold pada {tanggal or 'terbaru'}")

        results = []
        for row in saham_list:
            kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai = row
            
            # Ambil data historis 50 hari terakhir untuk saham ini hingga tanggal
            query_hist = sql.SQL('''
            SELECT "Tanggal Perdagangan Terakhir", "Penutupan", "Tertinggi", "Terendah"
            FROM {table}
            WHERE "Kode Saham" = %s AND "Tanggal Perdagangan Terakhir" <= %s
            ORDER BY "Tanggal Perdagangan Terakhir" ASC
            LIMIT 50
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query_hist, (kode_saham, tanggal or datetime.now().strftime('%Y-%m-%d')))
            hist_data = cur.fetchall()
            
            if len(hist_data) < 35:  # Minimal untuk MACD (26+9) dan Stochastic (14)
                logger.debug(f"Kode Saham {kode_saham} memiliki {len(hist_data)} hari data, dilewati")
                continue
            
            # Buat DataFrame dan konversi ke float
            df = pd.DataFrame(hist_data, columns=['Date', 'Close', 'High', 'Low'])
            df['Date'] = pd.to_datetime(df['Date'])
            df['Close'] = df['Close'].astype(float)
            df['High'] = df['High'].astype(float)
            df['Low'] = df['Low'].astype(float)
            prices = df['Close']
            highs = df['High']
            lows = df['Low']
            
            # Hitung MACD untuk Bullish Crossover
            ema12 = prices.ewm(span=12, adjust=False).mean()
            ema26 = prices.ewm(span=26, adjust=False).mean()
            macd = ema12 - ema26
            signal = macd.ewm(span=9, adjust=False).mean()
            
            macd_bullish_cross = False
            if len(macd) >= 2 and len(signal) >= 2:
                if macd.iloc[-1] > signal.iloc[-1] and macd.iloc[-2] <= signal.iloc[-2]:
                    macd_bullish_cross = True
                    logger.info(f"MACD Bullish Crossover ditemukan untuk {kode_saham}")
            
            # Hitung Stochastic Oscillator (14 periode)
            stochastic_period = 14
            if len(df) < stochastic_period:
                continue
            
            low_min = lows.rolling(window=stochastic_period).min()
            high_max = highs.rolling(window=stochastic_period).max()
            k = 100 * (prices - low_min) / (high_max - low_min)
            d = k.rolling(window=3).mean()
            
            stochastic_oversold = False
            if pd.notna(k.iloc[-1]) and pd.notna(d.iloc[-1]) and k.iloc[-1] < 20 and d.iloc[-1] < 20:
                stochastic_oversold = True
                logger.info(f"Stochastic Oversold ditemukan untuk {kode_saham}")
            
            # Kondisi potensi reversal: MACD Bullish Cross DAN Stochastic Oversold
            if macd_bullish_cross and stochastic_oversold:
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                results.append((kode_saham, nama_perusahaan, persentase, penutupan, 'Bullish Reversal', volume, nilai))

        if results:
            # Sort results berdasarkan persentase (descending)
            results.sort(key=lambda x: x[2], reverse=True)
            
            # Buat output teks
            response = f"Saham dengan MACD Bullish Crossover dan Stochastic Oversold (Potensi Reversal) pada {tanggal or 'terbaru'}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Signal Type   | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|---------------|-------------|------------|\n"
            for row in results:
                kode_saham, nama_perusahaan, persentase, penutupan, signal_type, volume, nilai = row
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {signal_type:<13} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            # Buat dan kirim gambar tabel
            title = f"Saham dengan MACD & Stochastic Oversold (Potensi Reversal) pada {tanggal or 'terbaru'}"
            try:
                image_files = create_table_image(results, title, is_macd=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"mash_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            # Kirim teks sebagai cadangan
            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Saham dengan potensi reversal ditemukan untuk tanggal: {tanggal or 'terbaru'}, jumlah: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan saham dengan MACD Bullish Crossover dan Stochastic Oversold untuk tanggal: {tanggal or 'terbaru'}")
            await message.answer(
                f"Tidak ditemukan saham dengan MACD Bullish Crossover dan Stochastic Oversold (potensi reversal) untuk tanggal {tanggal or 'terbaru'}. "
                f"Pastikan database memiliki data High, Low, Close untuk setidaknya 35 hari historis per saham."
            )
    except Exception as e:
        logger.error(f"Error saat mengambil data untuk /mash: {e}")
        await message.answer(f"Error saat mengambil data untuk /mash: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /stoch
@router.message(Command("stoch"))
async def cmd_stoch(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]  # Ambil argumen setelah /stoch
    logger.info(f"Perintah /stoch diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = args[0] if args else None
    
    if tanggal:
        try:
            datetime.strptime(tanggal, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Format tanggal salah: {tanggal} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan YYYY-MM-DD, misalnya: 2025-08-14")
            return
    else:
        # Gunakan tanggal terbaru dari database
        try:
            conn = psycopg2.connect(**db_config)
            cur = conn.cursor()
            query = sql.SQL('SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}').format(table=sql.Identifier('saham_data'))
            cur.execute(query)
            max_date = cur.fetchone()[0]
            tanggal = max_date.strftime('%Y-%m-%d') if max_date else datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Tanggal terbaru dari database: {tanggal}")
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error saat mengambil tanggal terbaru: {e}")
            await message.answer(f"Error saat mengambil tanggal terbaru: {e}")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /stoch: {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        # Dapatkan list kode saham unik pada tanggal tersebut
        query_saham = sql.SQL('''
        SELECT DISTINCT "Kode Saham", "Nama Perusahaan", "Penutupan", "Selisih", "Sebelumnya", "Volume", "Nilai"
        FROM {table}
        WHERE "Tanggal Perdagangan Terakhir" = %s
        ''').format(table=sql.Identifier('saham_data'))
        cur.execute(query_saham, (tanggal,))
        saham_list = cur.fetchall()
        logger.info(f"Memproses {len(saham_list)} saham untuk Stochastic Oversold pada {tanggal}")

        results = []
        for row in saham_list:
            kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai = row
            
            # Ambil data historis 50 hari terakhir untuk saham ini hingga tanggal
            query_hist = sql.SQL('''
            SELECT "Tanggal Perdagangan Terakhir", "Penutupan", "Tertinggi", "Terendah"
            FROM {table}
            WHERE "Kode Saham" = %s AND "Tanggal Perdagangan Terakhir" <= %s
            ORDER BY "Tanggal Perdagangan Terakhir" ASC
            LIMIT 50
            ''').format(table=sql.Identifier('saham_data'))
            cur.execute(query_hist, (kode_saham, tanggal))
            hist_data = cur.fetchall()
            
            if len(hist_data) < 14:  # Minimal untuk Stochastic 14 periode
                logger.debug(f"Kode Saham {kode_saham} memiliki {len(hist_data)} hari data, dilewati")
                continue
            
            # Buat DataFrame dan konversi ke float
            df = pd.DataFrame(hist_data, columns=['Date', 'Close', 'High', 'Low'])
            df['Date'] = pd.to_datetime(df['Date'])
            df['Close'] = df['Close'].astype(float)
            df['High'] = df['High'].astype(float)
            df['Low'] = df['Low'].astype(float)
            
            if df[['Close', 'High', 'Low']].isna().any().any():
                logger.debug(f"Kode Saham {kode_saham} memiliki nilai NULL di Close, High, atau Low, dilewati")
                continue
            
            prices = df['Close']
            highs = df['High']
            lows = df['Low']
            
            # Hitung Stochastic Oscillator (14 periode)
            stochastic_period = 14
            low_min = lows.rolling(window=stochastic_period).min()
            high_max = highs.rolling(window=stochastic_period).max()
            k = 100 * (prices - low_min) / (high_max - low_min).replace(0, np.nan)
            d = k.rolling(window=3).mean()
            
            if pd.notna(k.iloc[-1]) and pd.notna(d.iloc[-1]) and k.iloc[-1] < 20 and d.iloc[-1] < 20:
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                stochastic_level = f"%K={k.iloc[-1]:.2f}, %D={d.iloc[-1]:.2f}"
                results.append((kode_saham, nama_perusahaan, persentase, penutupan, stochastic_level, volume, nilai))
                logger.info(f"Stochastic Oversold ditemukan untuk {kode_saham} ({stochastic_level})")

        if results:
            # Sort results berdasarkan %K ascending (paling oversold di atas)
            results.sort(key=lambda x: float(x[4].split(',')[0].split('=')[1]))
            
            # Buat output teks
            response = f"Saham dengan Stochastic Oversold (< 20%) pada {tanggal}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Stochastic (%K/%D) | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|--------------------|-------------|------------|\n"
            for row in results:
                kode_saham, nama_perusahaan, persentase, penutupan, stochastic_level, volume, nilai = row
                nama_perusahaan = nama_perusahaan[:25] + "..." if len(nama_perusahaan) > 25 else nama_perusahaan
                emoji = "🟢" if persentase > 0 else "🔴" if persentase < 0 else ""
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {persentase:>6.2f}% | {penutupan:>9.2f} | {stochastic_level:<18} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            # Buat dan kirim gambar tabel
            title = f"Saham dengan Stochastic Oversold (< 20%) pada {tanggal}"
            try:
                image_files = create_table_image(results, title, is_macd=True)
                for i, temp_file in enumerate(image_files, 1):
                    if os.path.exists(temp_file):
                        logger.info(f"Mengirim gambar {temp_file} sebagai bagian {i}")
                        await message.answer_photo(FSInputFile(path=temp_file, filename=f"stoch_part_{i}.png"))
                        logger.info(f"Gambar {temp_file} dikirim sebagai bagian {i}")
                        try:
                            os.remove(temp_file)
                            logger.info(f"File sementara {temp_file} dihapus")
                        except Exception as e:
                            logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
                    else:
                        logger.error(f"File gambar {temp_file} tidak ditemukan")
                        await message.answer(f"Error: File gambar bagian {i} tidak ditemukan")
            except Exception as e:
                logger.error(f"Error saat membuat atau mengirim gambar: {e}")
                await message.answer(f"Error saat membuat atau mengirim gambar: {e}")

            # Kirim teks sebagai cadangan
            if len(response) > 4000:
                response_parts = []
                lines = response.split('\n')
                current_part = "```\n"
                for line in lines[2:]:
                    if len(current_part) + len(line) + 1 > 4000:
                        response_parts.append(current_part + "```")
                        current_part = "```\n" + line + "\n"
                    else:
                        current_part += line + "\n"
                if current_part.strip():
                    response_parts.append(current_part + "```")
                for i, part in enumerate(response_parts, 1):
                    await message.answer(part)
                    logger.info(f"Bagian teks {i} dikirim")
            else:
                await message.answer(response)
            logger.info(f"Saham Stochastic Oversold ditemukan untuk tanggal: {tanggal}, jumlah: {len(results)}")
        else:
            logger.warning(f"Tidak ditemukan saham dengan Stochastic Oversold untuk tanggal: {tanggal}")
            await message.answer(
                f"Tidak ditemukan saham dengan Stochastic Oversold (< 20%) untuk tanggal {tanggal}. "
                f"Pastikan database memiliki data High, Low, Close untuk setidaknya 14 hari historis per saham."
            )
    except Exception as e:
        logger.error(f"Error saat mengambil data untuk /stoch: {e}")
        await message.answer(f"Error saat mengambil data untuk /stoch: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Handler untuk perintah /stochg
@router.message(Command("stochg"))
async def cmd_stoch_graph(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]  # Ambil argumen setelah /stochg
    logger.info(f"Perintah /stochg diterima dari user_id: {user_id}, argumen: {args}")

    # Periksa argumen
    if len(args) == 1:
        kode_saham = args[0].upper()
        tanggal = None
    elif len(args) == 2:
        try:
            tanggal = datetime.strptime(args[0], '%Y-%m-%d').strftime('%Y-%m-%d')
            kode_saham = args[1].upper()
        except ValueError:
            logger.error(f"Format tanggal salah: {args[0]} dari user_id: {user_id}")
            await message.answer("Format tanggal salah. Gunakan /stochg [yyyy-mm-dd] <saham>, misalnya: /stochg 2025-08-14 BBCA")
            return
    else:
        logger.error(f"Argumen tidak valid dari user_id: {user_id}, argumen: {args}")
        await message.answer("Gunakan /stochg <saham> atau /stochg yyyy-mm-dd <saham>, misalnya: /stochg BBCA atau /stochg 2025-08-14 BBCA")
        return

    # Ambil tanggal terbaru jika tidak ada tanggal
    if not tanggal:
        try:
            conn = psycopg2.connect(**db_config)
            cur = conn.cursor()
            query = sql.SQL('SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}').format(table=sql.Identifier('saham_data'))
            cur.execute(query)
            max_date = cur.fetchone()[0]
            tanggal = max_date.strftime('%Y-%m-%d') if max_date else datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Tanggal terbaru dari database untuk {kode_saham}: {tanggal}")
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error saat mengambil tanggal terbaru: {e}")
            await message.answer(f"Error saat mengambil tanggal terbaru: {e}")
            return

    try:
        logger.info(f"Membuka koneksi database untuk query /stochg {kode_saham} pada {tanggal}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        # Ambil data historis 50 hari untuk saham
        query_hist = sql.SQL('''
        SELECT "Tanggal Perdagangan Terakhir", "Penutupan", "Tertinggi", "Terendah", "Volume"
        FROM {table}
        WHERE "Kode Saham" = %s AND "Tanggal Perdagangan Terakhir" <= %s
        ORDER BY "Tanggal Perdagangan Terakhir" ASC
        LIMIT 50
        ''').format(table=sql.Identifier('saham_data'))
        cur.execute(query_hist, (kode_saham, tanggal))
        hist_data = cur.fetchall()

        if len(hist_data) < 14:
            logger.warning(f"Kode Saham {kode_saham} hanya memiliki {len(hist_data)} hari data, minimal 14 diperlukan")
            await message.answer(f"Data tidak cukup untuk {kode_saham} pada {tanggal}. Diperlukan minimal 14 hari data historis.")
            return

        # Buat DataFrame dan konversi ke float
        df = pd.DataFrame(hist_data, columns=['Date', 'Close', 'High', 'Low', 'Volume'])
        df['Date'] = pd.to_datetime(df['Date'])
        df['Close'] = df['Close'].astype(float)
        df['High'] = df['High'].astype(float)
        df['Low'] = df['Low'].astype(float)
        df['Volume'] = df['Volume'].astype(float)

        if df[['Close', 'High', 'Low', 'Volume']].isna().any().any():
            logger.warning(f"Kode Saham {kode_saham} memiliki nilai NULL di Close, High, Low, atau Volume")
            await message.answer(f"Data tidak valid untuk {kode_saham} pada {tanggal}. Terdapat nilai NULL di harga atau volume.")
            return

        prices = df['Close']
        highs = df['High']
        lows = df['Low']
        volumes = df['Volume']

        # Hitung Stochastic Oscillator (14 periode)
        stochastic_period = 14
        low_min = lows.rolling(window=stochastic_period).min()
        high_max = highs.rolling(window=stochastic_period).max()
        k = 100 * (prices - low_min) / (high_max - low_min).replace(0, np.nan)
        d = k.rolling(window=3).mean()

        if pd.isna(k.iloc[-1]) or pd.isna(d.iloc[-1]):
            logger.warning(f"Kode Saham {kode_saham} memiliki nilai Stochastic tidak valid pada {tanggal}")
            await message.answer(f"Nilai Stochastic tidak valid untuk {kode_saham} pada {tanggal}. Pastikan data High dan Low valid.")
            return

        # Hitung rasio volume (volume hari ini / average 10 hari terakhir)
        avg_volume_10 = volumes.rolling(window=10).mean().iloc[-1] if len(volumes) >= 10 else volumes.mean()
        volume_today = volumes.iloc[-1]
        volume_ratio = volume_today / avg_volume_10 if avg_volume_10 > 0 else 0

        # Deteksi akumulasi/distribusi berdasarkan rasio volume dan change harga
        selisih = prices.iloc[-1] - prices.iloc[-2] if len(prices) >= 2 else 0
        persentase = (selisih / prices.iloc[-2] * 100) if len(prices) >= 2 and prices.iloc[-2] > 0 else 0
        status_volume = "Akumulasi" if volume_ratio > 1 and persentase > 0 else "Distribusi" if volume_ratio > 1 and persentase < 0 else "Normal"

        # Buat grafik
        plt.style.use('default')
        fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 10), sharex=True, gridspec_kw={'height_ratios': [2, 1, 1]})

        # Plot harga penutupan
        ax1.plot(df['Date'], df['Close'], label='Close Price', color='blue')
        ax1.set_title(f'Harga Saham, Stochastic Oscillator, dan Volume untuk {kode_saham} hingga {tanggal}')
        ax1.set_ylabel('Harga Penutupan (Rp)')
        ax1.legend(loc='upper left')
        ax1.grid(True)

        # Plot Stochastic Oscillator
        ax2.plot(df['Date'], k, label='%K', color='blue')
        ax2.plot(df['Date'], d, label='%D', color='red', linestyle='--')
        ax2.axhline(y=80, color='orange', linestyle='--', label='Overbought (80)')
        ax2.axhline(y=20, color='green', linestyle='--', label='Oversold (20)')
        ax2.set_title('Stochastic Oscillator (%K, %D)')
        ax2.set_ylabel('Stochastic (%)')
        ax2.legend(loc='upper left')
        ax2.grid(True)

        # Plot volume
        ax3.bar(df['Date'], df['Volume'], label='Volume', color='gray')
        ax3.set_title('Volume Perdagangan')
        ax3.set_ylabel('Volume')
        ax3.legend(loc='upper left')
        ax3.grid(True)

        # Format sumbu X
        ax3.xaxis.set_major_formatter(DateFormatter('%Y-%m-%d'))
        plt.xticks(rotation=45)
        plt.tight_layout()

        # Tambahkan footer pada grafik
        fig.text(0.5, 0.01, "Created by love with bisnis-it.com", ha='center', fontsize=10)

        # Simpan grafik ke file sementara
        temp_file = f"stoch_{kode_saham}_{tanggal}.png"
        plt.savefig(temp_file, dpi=150, bbox_inches='tight')
        plt.close(fig)
        logger.info(f"Grafik disimpan sebagai {temp_file}")

        # Kirim grafik
        if os.path.exists(temp_file):
            # Kirim pesan teks dengan nilai %K, %D, rasio volume, dan status
            stochastic_status = "Oversold" if k.iloc[-1] < 20 and d.iloc[-1] < 20 else "Normal"
            response = (
                f"Stochastic Oscillator untuk {kode_saham} pada {tanggal}:\n"
                f"%K = {k.iloc[-1]:.2f}, %D = {d.iloc[-1]:.2f} ({stochastic_status})\n"
                f"Rasio Volume: {volume_ratio:.2f} (Volume Hari Ini / Average 10 Hari)\n"
                f"Status Volume: {status_volume}"
            )
            await message.answer(response)
            logger.info(f"Status Stochastic dan Volume untuk {kode_saham}: {response}")

            # Kirim gambar
            await message.answer_photo(FSInputFile(path=temp_file, filename=f"stoch_{kode_saham}_{tanggal}.png"))
            logger.info(f"Grafik {temp_file} dikirim")
            try:
                os.remove(temp_file)
                logger.info(f"File sementara {temp_file} dihapus")
            except Exception as e:
                logger.error(f"Gagal menghapus file sementara {temp_file}: {e}")
        else:
            logger.error(f"File grafik {temp_file} tidak ditemukan")
            await message.answer(f"Error: File grafik untuk {kode_saham} tidak ditemukan")

    except Exception as e:
        logger.error(f"Error saat mengambil data untuk /stochg {kode_saham}: {e}")
        await message.answer(f"Error saat mengambil data untuk {kode_saham}: {e}")
    finally:
        cur.close()
        conn.close()
        logger.info("Koneksi database ditutup")

# Fungsi utama untuk memulai bot
async def main():
    logger.info("Memulai bot...")

    try:
        bot = Bot(token=BOT_TOKEN)
        dp = Dispatcher()
        dp.include_router(router)
        logger.info("Start polling")
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Error saat memulai bot: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())