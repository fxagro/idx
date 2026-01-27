import os
import tempfile
from PIL import Image, ImageDraw, ImageFont
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

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
        cell_widths = [100, 300, 150, 120, 150, 150, 150]
    elif is_period:
        cell_widths = [100, 300, 150, 120, 120, 150, 150]  # Ticker, Company Name, Change (%), Close, Open, Volume, Value
    else:
        cell_widths = [100, 300, 150, 120, 150, 150]
    cell_height = 35
    header_height = 40
    footer_height = 30  # Ruang untuk footer
    font_size = 16
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
        
        # Hitung dimensi gambar dengan ruang untuk footer
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
                    nama_perusahaan[:30] + "..." if len(nama_perusahaan) > 30 else nama_perusahaan,
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
                    nama_perusahaan[:30] + "..." if len(nama_perusahaan) > 30 else nama_perusahaan,
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
                    nama_perusahaan[:30] + "..." if len(nama_perusahaan) > 30 else nama_perusahaan,
                    f"{persentase:.2f}%" if isinstance(persentase, (int, float)) else persentase,
                    f"{penutupan:.2f}" if isinstance(penutupan, (int, float)) else penutupan,
                    cross_type,
                    f"{volume:,}" if isinstance(volume, (int, float)) else volume,
                    format_value(nilai)
                ]
            else:
                kode_saham, nama_perusahaan, penutupan, selisih, sebelumnya, volume, nilai = row
                persentase = (selisih / sebelumnya * 100) if sebelumnya else 0
                row_data = [
                    kode_saham,
                    nama_perusahaan[:30] + "..." if len(nama_perusahaan) > 30 else nama_perusahaan,
                    f"{persentase:.2f}%",
                    f"{penutupan:.2f}" if isinstance(penutupan, (int, float)) else penutupan,
                    f"{volume:,}" if isinstance(volume, (int, float)) else volume,
                    format_value(nilai)
                ]
            x = 0
            for i, cell in enumerate(row_data):
                # Atur warna berdasarkan nilai persentase untuk kolom Change (%)
                if (is_period and i == 2) or (is_macd and i == 2) or (not is_accum and not is_period and not is_macd and i == 2):
                    try:
                        persentase_val = float(cell.strip('%')) if isinstance(cell, str) and '%' in cell else 0
                        fill_color = 'lightgreen' if persentase_val > 0 else 'salmon' if persentase_val < 0 else 'white'
                    except (ValueError, TypeError):
                        fill_color = 'white'
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
        draw.text((10, y + 10), "Created by bisnis-it.com/saham", fill='black', font=font)

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

@router.message(Command("tg"))
async def cmd_top_gainers(message: Message) -> None:
    user_id = message.from_user.id
    args = message.text.split()[1:]  # Ambil argumen setelah /tg
    logger.info(f"Perintah /tg diterima dari user_id: {user_id}, argumen: {args}")
    
    tanggal = None
    jumlah_hari = None
    
    # Parsing argumen
    if len(args) == 1:
        try:
            jumlah_hari = int(args[0])  # Coba parse sebagai jumlah hari
            if jumlah_hari <= 0:
                raise ValueError("Jumlah hari harus lebih dari 0")
        except ValueError:
            try:
                datetime.strptime(args[0], '%Y-%m-%d')  # Coba parse sebagai tanggal
                tanggal = args[0]
                jumlah_hari = 1  # Default ke harian jika hanya tanggal
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
        jumlah_hari = 1  # Default ke harian jika tidak ada argumen

    try:
        logger.info(f"Membuka koneksi database untuk query /tg: tanggal={tanggal}, jumlah_hari={jumlah_hari}")
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
    except Exception as e:
        logger.error(f"Error koneksi ke database: {e}")
        await message.answer(f"Error koneksi ke database: {e}")
        return

    try:
        # Ambil tanggal terbaru jika tidak ada tanggal
        if not tanggal:
            query = sql.SQL('SELECT MAX("Tanggal Perdagangan Terakhir") FROM {table}').format(table=sql.Identifier('saham_data'))
            cur.execute(query)
            max_date = cur.fetchone()[0]
            tanggal = max_date.strftime('%Y-%m-%d') if max_date else datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Tanggal terbaru dari database: {tanggal}")

        # Hitung tanggal awal berdasarkan jumlah_hari
        tanggal_akhir = datetime.strptime(tanggal, '%Y-%m-%d')
        tanggal_awal = tanggal_akhir - timedelta(days=jumlah_hari)
        tanggal_awal_str = tanggal_awal.strftime('%Y-%m-%d')
        logger.info(f"Menghitung Top Gainers dari {tanggal_awal_str} hingga {tanggal}")

        # Query untuk mendapatkan data pada tanggal akhir dan awal dengan Open Price diganti oleh Penutupan terakhir jika kosong
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
            # Buat output teks
            periode = f"{jumlah_hari} hari" if jumlah_hari > 1 else "harian"
            response = f"Top Gainers ({periode}) dari {tanggal_awal_str} hingga {tanggal}:\n\n"
            response += "```\n"
            response += "| Ticker | Company Name          | Change (%)    | Close     | Open       | Volume      | Value (Rp) |\n"
            response += "|--------|-----------------------|---------------|-----------|------------|-------------|------------|\n"
            table_data = []
            for row in results:
                kode_saham, nama_perusahaan, penutupan, volume, nilai, open_price, penutupan_awal = row
                persentase = ((penutupan - penutupan_awal) / penutupan_awal * 100) if penutupan_awal and penutupan_awal > 0 else 0
                nama_perusahaan = nama_perusahaan[:20] + "..." if len(nama_perusahaan) > 20 else nama_perusahaan
                formatted_persentase = f"{persentase:.2f}%"
                table_data.append((kode_saham, nama_perusahaan, formatted_persentase, penutupan, open_price, volume, nilai))
                emoji = "🟢" if persentase > 0 else ""  # Hanya gainer yang ditampilkan
                response += (
                    f"| {kode_saham:<6} | {nama_perusahaan:<21} | {emoji} {formatted_persentase:>6} | {penutupan:>9.2f} | {open_price:>10.2f} | {volume:>11,d} | {format_value(nilai):>10} |\n"
                )
            response += "```"

            # Buat dan kirim gambar tabel
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