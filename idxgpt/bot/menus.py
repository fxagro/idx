"""
Menu functions for BJB Sekuritas Telegram Bot
Contains all show_*_menu and state handling functions
"""

import logging
import random
import pytz
from datetime import datetime
from typing import Dict, List, Optional

from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from config import MOTIVATIONS
from enums import MenuState
from utils import safe_log, get_greeting

# Setup logging
logger = logging.getLogger(__name__)

async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show main menu with greeting and motivational message"""
    try:
        # Get user name
        user = update.effective_user
        user_name = user.first_name if user and user.first_name else "Sobat Trader"

        # Get current time in WIB
        wib_timezone = pytz.timezone('Asia/Jakarta')
        current_time = datetime.now(wib_timezone)
        hour = current_time.hour
        time_str = current_time.strftime('%d %B %Y, %H:%M WIB')

        # Determine greeting based on time
        if 0 <= hour < 12:
            greeting = "Selamat Pagi"
        elif 12 <= hour < 15:
            greeting = "Selamat Siang"
        elif 15 <= hour < 18:
            greeting = "Selamat Sore"
        else:
            greeting = "Selamat Malam"

        # Get random motivation
        motivation = random.choice(MOTIVATIONS)

        # Create main menu keyboard
        main_keyboard = [
            ["📊 Dashboard", "👤 Setting"],
            ["🏢 About BJB Sekuritas", "❓ Help"],
            ["💳 Langganan"],
            ["👥 Join Group"]
        ]
        main_reply_markup = ReplyKeyboardMarkup(
            main_keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih opsi:"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.MAIN_MENU.value

        # Create welcome message
        welcome_message = (
            f"👋 *{greeting}, {user_name}!* Hari ini tanggal {time_str}\n\n"
            "Selamat datang di BJB Sekuritas Bot, asisten setia untuk petualangan investasi dan tradingmu! 🎯\n"
            f"{motivation}\n\n"
            "Pilih opsi di bawah untuk memulai, atau ketik /h untuk lihat semua fitur keren kami!\n"
            "💡 *Tips*: Coba fitur 'Dashboard' untuk update pasar terkini!"
        )

        # Send welcome message with main menu
        await update.message.reply_text(
            welcome_message,
            reply_markup=main_reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Main menu shown to user {user_id}"))

    except pytz.exceptions.PytzError as e:
        logger.error(safe_log(f"Timezone error in show_main_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan dengan pengaturan waktu. Silakan coba lagi.",
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(safe_log(f"Error in show_main_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu utama. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_submenu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show dashboard submenu"""
    try:
        # Create submenu keyboard
        keyboard = [
            ["📈 Saham", "💰 Crypto"],
            ["🌍 Pasar Global", "⚙️ Lainnya"],
            ["⬅️ Kembali ke Menu Utama"]
        ]
        # Add main buttons at bottom
        keyboard.append(["Dashboard", "Pengaturan"])
        keyboard.append(["Profil"])

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih kategori:"
        )

        # Submenu message
        message = (
            "📋 *Dashboard*\n\n"
            "Pilih kategori untuk menjelajahi fitur:\n"
            "- 📈 *Saham*: Analisis saham dari sisi Teknikal Fundamental Sentimen Market dan bandarmology (LQ45, JII70, KOMPAS100, dll.)\n"
            "- 🌍 *Pasar Global*: Indeks global, Gold, komoditas, mata uang\n"
            "- 💰 *Crypto*: Data cryptocurrency\n"
            "- ⚙️ *Lainnya*: Robot AI, Langganan, feedback dll\n"
        )

        await update.message.reply_text(
            message,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.SUBMENU.value

        logger.info(safe_log("Submenu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_submenu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan submenu. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_saham_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show saham (stock) menu"""
    try:
        keyboard = [
            ["Saham LQ45", "Saham JII70", "Saham KOMPAS100"],
            ["Top Gainers", "Top Losers", "Heatmap Indeks"],
            ["Analisis Teknikal", "Analisis Fundamental", "Sinyal Trading"],
            ["Value Investing", "Volatilitas", "Daftar Pantauan"],
            ["⬅️ Kembali ke Submenu"]
        ]
        # Add main buttons at bottom
        keyboard.append(["Dashboard", "AI BJB Sekuritas"])
        keyboard.append(["Profil"])

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih opsi saham:"
        )

        await update.message.reply_text(
            "📈 *Menu Saham*\nPilih opsi untuk analisis saham:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.SAHAM.value

        logger.info(safe_log("Saham menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_saham_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu saham. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_crypto_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show crypto menu"""
    try:
        # Set state
        context.user_data["menu_state"] = MenuState.CRYPTO.value

        keyboard = [
            ["Top 10 Crypto", "Eksplorasi Crypto"],
            ["⬅️ Kembali ke Submenu"]
        ]
        # Add main buttons at bottom
        keyboard.append(["Dashboard", "Pengaturan"])
        keyboard.append(["Profil"])

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih opsi crypto:"
        )

        await update.message.reply_text(
            "💰 *Menu Crypto*\nPilih opsi untuk data cryptocurrency:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log("Crypto menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_crypto_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu crypto. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_global_market_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show global market menu"""
    try:
        keyboard = [
            ["Indeks Global", "Komoditas", "Major Currencies"],
            ["⬅️ Kembali ke Submenu"]
        ]
        # Add main buttons at bottom
        keyboard.append(["Dashboard", "Pengaturan"])
        keyboard.append(["Profil"])

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih opsi pasar global:"
        )

        await update.message.reply_text(
            "🌍 *Menu Pasar Global*\nPilih opsi untuk data pasar global:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.GLOBAL_MARKET.value

        logger.info(safe_log("Global market menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_global_market_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu pasar global. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_lainnya_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show lainnya (other) menu"""
    try:
        keyboard = [
            ["Langganan", "Feedback"],
            ["⬅️ Kembali ke Submenu"]
        ]
        # Add main buttons at bottom
        keyboard.append(["Dashboard", "Pengaturan"])
        keyboard.append(["Profil"])

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Pilih opsi lainnya:"
        )

        await update.message.reply_text(
            "⚙️ *Menu Lainnya*\nPilih opsi lainnya:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.LAINNYA.value

        logger.info(safe_log("Lainnya menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_lainnya_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu lainnya. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_explore_crypto_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show crypto exploration menu"""
    try:
        # Set state
        context.user_data["menu_state"] = MenuState.CRYPTO.value
        context.user_data["explore_mode"] = "explore"

        reply_keyboard = [
            ["Top 10 by Market Cap", "Top 10 Gainers (24h)"],
            ["Top 10 Losers (24h)", "Search by Symbol"],
            ["⬅️ Kembali ke Menu Crypto"]
        ]
        markup = ReplyKeyboardMarkup(reply_keyboard, resize_keyboard=True, one_time_keyboard=False)

        await update.message.reply_text(
            "💰 *Menu Eksplorasi Cryptocurrency*\nPilih opsi di bawah untuk melihat data:",
            reply_markup=markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log("Crypto exploration menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_explore_crypto_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu eksplorasi crypto. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_top_gainers_period_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show period selection menu for top gainers"""
    try:
        keyboard = [["harian", "mingguan"], ["⬅️ Kembali ke Menu Saham"]]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        await update.message.reply_text(
            "Pilih periode untuk Top Gainers (harian/mingguan):",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set pending action
        context.user_data["pending_action"] = "top_gainers"

        logger.info(safe_log("Top gainers period menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_top_gainers_period_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu periode. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_top_losers_period_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show period selection menu for top losers"""
    try:
        keyboard = [["harian", "mingguan"], ["⬅️ Kembali ke Menu Saham"]]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        await update.message.reply_text(
            "Pilih periode untuk Top Losers (harian/mingguan):",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set pending action
        context.user_data["pending_action"] = "top_losers"

        logger.info(safe_log("Top losers period menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_top_losers_period_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu periode. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_search_symbol_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show search symbol menu for crypto"""
    try:
        context.user_data["explore_mode"] = "search_symbol"

        await update.message.reply_text(
            "💰 *Cari Crypto Berdasarkan Simbol*\n\n"
            "Ketik simbol cryptocurrency (misalnya: BTC, ETH) untuk melihat informasi detail.\n"
            "Ketik 'Cancel' untuk kembali.",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Search symbol menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_search_symbol_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu pencarian. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_technical_analysis_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str):
    """Show technical analysis submenu for a specific ticker"""
    try:
        keyboard = [
            # Trend indicators
            ["MA 5", "MA 20"],
            ["MA 50", "MA 100"],
            ["MA 200", "PSAR"],
            ["Ichimoku Cloud", "RSI"],
            ["Stochastic", "MACD"],
            ["Williams %R", "OBV"],
            ["VWAP", "CMF"],
            ["ATR", "StdDev"],
            ["Bollinger Bands"],
            ["Kembali ke Menu"]
        ]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        await update.message.reply_text(
            f"Pilih indikator teknikal untuk {ticker}:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Technical analysis menu shown for {ticker}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_technical_analysis_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu analisis teknikal. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_stock_list_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, index_name: str, stocks: Dict[str, str]):
    """Show stock list menu for a specific index"""
    try:
        keyboard = []
        for ticker in stocks.keys():
            keyboard.append([ticker])

        keyboard.append(["Kembali ke Menu"])

        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        await update.message.reply_text(
            f"Daftar saham {index_name}. Pilih saham untuk analisis:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Stock list menu shown for {index_name}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_stock_list_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan daftar saham. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_settings_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show settings menu"""
    try:
        keyboard = [
            ["Notifikasi", "Tema"],
            ["Bahasa", "Kembali ke Menu Utama"]
        ]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        await update.message.reply_text(
            "👤 *Pengaturan*\n\n"
            "Fitur ini akan memungkinkan Anda untuk mengatur preferensi bot, seperti:\n"
            "- Mengaktifkan/menonaktifkan notifikasi pasar\n"
            "- Memilih tema (terang/gelap)\n"
            "- Mengatur preferensi bahasa\n\n"
            "Fitur ini sedang dalam pengembangan. Nantikan pembaruan selanjutnya!",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set state
        context.user_data["menu_state"] = MenuState.SETTINGS.value

        logger.info(safe_log("Settings menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_settings_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu pengaturan. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_about_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show about BJB Sekuritas menu"""
    try:
        await update.message.reply_text(
            "🏢 *Tentang BJB Sekuritas*\n\n"
            "BJB Sekuritas adalah perusahaan sekuritas terkemuka di Indonesia yang menyediakan layanan investasi saham, obligasi, dan reksa dana. "
            "Kami berkomitmen untuk membantu investor mencapai tujuan keuangan mereka dengan menyediakan data pasar terkini dan analisis mendalam.\n\n"
            "Untuk informasi lebih lanjut, kunjungi situs resmi kami di www.bjbsekuritas.co.id (sedang dalam pengembangan).",
            parse_mode="Markdown"
        )

        # Show main menu again
        await show_main_menu(update, context)

        logger.info(safe_log("About menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_about_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan informasi tentang. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_help_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help menu"""
    try:
        await update.message.reply_text(
            "❓ *Bantuan*\n\n"
            "Berikut adalah beberapa perintah yang tersedia untuk menggunakan bot ini:\n"
            "- /start: Memulai ulang bot dan menampilkan menu utama\n"
            "- /tg: Melihat Top Gainers saham\n"
            "- /tl: Melihat Top Losers saham\n"
            "- /tc: Melihat Top 10 Crypto\n"
            "- /ig: Melihat Indeks Global\n"
            "- /akun: Buat 10 akun Demo otomatis dan simulasi realtime trading saham\n"
            "- /sal: Melihat saldo akun demo\n"
            "- /tgusa: Melihat Top Gainers Saham USA\n"
            "- /tgc: Filter top gainers Crypto dari CoinMarketCap dengan cepat\n\n"
            "Untuk navigasi, gunakan tombol menu yang tersedia. Jika Anda memiliki pertanyaan, silakan hubungi tim support (sedang dalam pengembangan).",
            parse_mode="Markdown"
        )

        # Show main menu again
        await show_main_menu(update, context)

        logger.info(safe_log("Help menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_help_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan bantuan. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_subscription_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show subscription menu"""
    try:
        await update.message.reply_text(
            "💳 *Langganan*\n\n"
            "Dengan berlangganan premium, Anda akan mendapatkan akses ke fitur eksklusif, seperti:\n"
            "- Analisis saham mendalam\n"
            "- Sinyal trading harian\n"
            "- Notifikasi pasar secara real-time\n"
            "- Akses ke grup komunitas premium\n\n"
            "Fitur langganan sedang dalam pengembangan. Nantikan informasi lebih lanjut!",
            parse_mode="Markdown"
        )

        # Show main menu again
        await show_main_menu(update, context)

        logger.info(safe_log("Subscription menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_subscription_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan informasi langganan. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_join_group_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show join group menu"""
    try:
        await update.message.reply_text(
            "👥 *Bergabung dengan Grup Komunitas*\n\n"
            "Bergabunglah dengan komunitas investor kami untuk berdiskusi, berbagi tips, dan mendapatkan update pasar terbaru!\n\n"
            "Saat ini, grup komunitas belum tersedia. Nantikan pembaruan untuk tautan grup Telegram atau WhatsApp kami!",
            parse_mode="Markdown"
        )

        # Show main menu again
        await show_main_menu(update, context)

        logger.info(safe_log("Join group menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_join_group_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan informasi grup. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_technical_analysis_submenu(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str):
    """Show technical analysis submenu with inline keyboard"""
    try:
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = [
            # Trend indicators
            [InlineKeyboardButton("MA5", callback_data=f"ma5_{ticker}"),
             InlineKeyboardButton("MA20", callback_data=f"ma20_{ticker}")],
            [InlineKeyboardButton("MA50", callback_data=f"ma50_{ticker}"),
             InlineKeyboardButton("MA100", callback_data=f"ma100_{ticker}")],
            [InlineKeyboardButton("MA200", callback_data=f"ma200_{ticker}"),
             InlineKeyboardButton("PSAR", callback_data=f"psar_{ticker}")],
            [InlineKeyboardButton("Ichimoku", callback_data=f"ichimoku_{ticker}"),
             InlineKeyboardButton("RSI", callback_data=f"rsi_{ticker}")],
            [InlineKeyboardButton("Stochastic", callback_data=f"stochastic_{ticker}"),
             InlineKeyboardButton("MACD", callback_data=f"macd_{ticker}")],
            [InlineKeyboardButton("Williams %R", callback_data=f"willr_{ticker}"),
             InlineKeyboardButton("OBV", callback_data=f"obv_{ticker}")],
            [InlineKeyboardButton("VWAP", callback_data=f"vwap_{ticker}"),
             InlineKeyboardButton("CMF", callback_data=f"cmf_{ticker}")],
            [InlineKeyboardButton("ATR", callback_data=f"atr_{ticker}"),
             InlineKeyboardButton("StdDev", callback_data=f"stddev_{ticker}")],
            [InlineKeyboardButton("Bollinger Bands", callback_data=f"bollinger_{ticker}")],
            [InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        from config import INDEX_STOCKS
        company_name = ""
        for index_stocks in INDEX_STOCKS.values():
            if ticker in index_stocks:
                company_name = index_stocks[ticker]
                break

        await update.message.reply_text(
            f"Pilih indikator teknikal untuk {ticker} - {company_name}:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Technical analysis submenu shown for {ticker}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_technical_analysis_submenu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan submenu analisis teknikal. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_stock_analysis_submenu(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str, index: str):
    """Show stock analysis submenu with inline keyboard"""
    try:
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        submenu_keyboard = [
            [InlineKeyboardButton("Cek Data Saham", callback_data=f"c_{ticker}")],
            [InlineKeyboardButton("Analisis Teknikal", callback_data=f"at_{ticker}")],
            [InlineKeyboardButton("Candlestick Chart", callback_data=f"ch_{ticker}")],
            [InlineKeyboardButton("Sinyal Trading", callback_data=f"signal_{ticker}")],
            [InlineKeyboardButton("Prediksi Harga", callback_data=f"predict_{ticker}")],
            [InlineKeyboardButton("Analisis Fundamental", callback_data=f"af_{ticker}")],
            [InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(submenu_keyboard)

        from config import INDEX_STOCKS
        company_name = INDEX_STOCKS.get(index, {}).get(ticker, "Nama tidak tersedia")

        await update.message.reply_text(
            f"Pilih analisis untuk {ticker} - {company_name}:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Stock analysis submenu shown for {ticker} from {index}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_stock_analysis_submenu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan submenu analisis saham. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_index_heatmap_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show index selection menu for heatmap"""
    try:
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = [
            [InlineKeyboardButton("KOMPAS100", callback_data="heatmap_kompas100")],
            [InlineKeyboardButton("LQ45", callback_data="heatmap_lq45")],
            [InlineKeyboardButton("JII70", callback_data="heatmap_jii70")],
            [InlineKeyboardButton("Kembali ke Menu", callback_data="back_to_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            "Pilih indeks untuk melihat heatmap perubahan harga:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        logger.info(safe_log("Index heatmap menu shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_index_heatmap_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu heatmap. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_period_selection_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, action: str):
    """Show period selection menu for analysis"""
    try:
        keyboard = [
            ["harian", "mingguan"],
            ["bulanan"],
            ["⬅️ Kembali ke Menu"]
        ]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True)

        if action == "top_gainers":
            message = "Pilih periode untuk Top Gainers:"
        elif action == "top_losers":
            message = "Pilih periode untuk Top Losers:"
        else:
            message = "Pilih periode untuk analisis:"

        await update.message.reply_text(
            message,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

        # Set pending action
        context.user_data["pending_action"] = action

        logger.info(safe_log(f"Period selection menu shown for {action}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_period_selection_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan menu pemilihan periode. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_error_message(update: Update, context: ContextTypes.DEFAULT_TYPE, error: str):
    """Show error message and return to appropriate menu"""
    try:
        current_state = context.user_data.get("menu_state", MenuState.MAIN_MENU.value)

        await update.message.reply_text(
            f"❌ Error: {error}\n\nKembali ke menu sebelumnya.",
            parse_mode="Markdown"
        )

        # Return to appropriate menu based on state
        if current_state == MenuState.MAIN_MENU.value:
            await show_main_menu(update, context)
        elif current_state == MenuState.SUBMENU.value:
            await show_submenu(update, context)
        elif current_state == MenuState.SAHAM.value:
            await show_saham_menu(update, context)
        elif current_state == MenuState.CRYPTO.value:
            await show_crypto_menu(update, context)
        elif current_state == MenuState.GLOBAL_MARKET.value:
            await show_global_market_menu(update, context)
        elif current_state == MenuState.LAINNYA.value:
            await show_lainnya_menu(update, context)
        else:
            await show_main_menu(update, context)

        logger.info(safe_log(f"Error message shown: {error}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_error_message: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat menampilkan pesan error. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def reset_to_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reset to main menu and clear states"""
    try:
        # Clear all user data
        context.user_data.clear()

        # Show main menu
        await show_main_menu(update, context)

        logger.info(safe_log("Reset to main menu"))

    except Exception as e:
        logger.error(safe_log(f"Error in reset_to_main_menu: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat kembali ke menu utama. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def handle_menu_navigation(update: Update, context: ContextTypes.DEFAULT_TYPE, target_state: MenuState):
    """Handle navigation to specific menu state"""
    try:
        context.user_data["menu_state"] = target_state.value

        if target_state == MenuState.MAIN_MENU:
            await show_main_menu(update, context)
        elif target_state == MenuState.SUBMENU:
            await show_submenu(update, context)
        elif target_state == MenuState.SAHAM:
            await show_saham_menu(update, context)
        elif target_state == MenuState.CRYPTO:
            await show_crypto_menu(update, context)
        elif target_state == MenuState.GLOBAL_MARKET:
            await show_global_market_menu(update, context)
        elif target_state == MenuState.LAINNYA:
            await show_lainnya_menu(update, context)
        else:
            await show_main_menu(update, context)

        logger.info(safe_log(f"Navigated to {target_state.value}"))

    except Exception as e:
        logger.error(safe_log(f"Error in handle_menu_navigation: {str(e)}"))
        await update.message.reply_text(
            "Terjadi kesalahan saat navigasi menu. Silakan coba lagi.",
            parse_mode="Markdown"
        )

async def show_loading_message(update: Update, context: ContextTypes.DEFAULT_TYPE, operation: str):
    """Show loading message"""
    try:
        await update.message.reply_text(
            f"⏳ {operation}... Mohon tunggu sebentar.",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Loading message shown: {operation}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_loading_message: {str(e)}"))

async def show_success_message(update: Update, context: ContextTypes.DEFAULT_TYPE, message: str):
    """Show success message"""
    try:
        await update.message.reply_text(
            f"✅ {message}",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Success message shown: {message}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_success_message: {str(e)}"))

async def show_info_message(update: Update, context: ContextTypes.DEFAULT_TYPE, title: str, content: str):
    """Show info message"""
    try:
        await update.message.reply_text(
            f"ℹ️ *{title}*\n\n{content}",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Info message shown: {title}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_info_message: {str(e)}"))

async def show_warning_message(update: Update, context: ContextTypes.DEFAULT_TYPE, warning: str):
    """Show warning message"""
    try:
        await update.message.reply_text(
            f"⚠️ {warning}",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Warning message shown: {warning}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_warning_message: {str(e)}"))

async def show_premium_required_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show premium required message"""
    try:
        await update.message.reply_text(
            "🔒 *Fitur Premium*\n\n"
            "Fitur ini memerlukan akses premium. Untuk mengupgrade:\n\n"
            "1. Buka akun RDN di BJB Sekuritas dengan minimal transaksi Rp10.000.000/bulan\n"
            "2. Atau berlangganan premium Rp50.000/bulan\n\n"
            "Kunjungi: https://opening-jb.bofis.id/#/",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Premium required message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_premium_required_message: {str(e)}"))

async def show_access_denied_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show access denied message"""
    try:
        await update.message.reply_text(
            "🚫 *Akses Ditolak*\n\n"
            "Anda telah mencapai batas akses gratis (3 kali/hari).\n\n"
            "Untuk akses penuh:\n"
            "1. Buka akun RDN di BJB Sekuritas (minimal transaksi Rp10.000.000/bulan)\n"
            "2. Atau berlangganan premium Rp50.000/bulan\n\n"
            "Kunjungi: https://opening-jb.bofis.id/#/",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Access denied message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_access_denied_message: {str(e)}"))

async def show_under_development_message(update: Update, context: ContextTypes.DEFAULT_TYPE, feature: str):
    """Show under development message"""
    try:
        await update.message.reply_text(
            f"🔧 *Fitur Dalam Pengembangan*\n\n"
            f"Fitur '{feature}' sedang dalam pengembangan.\n"
            "Nantikan pembaruan selanjutnya!",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Under development message shown for {feature}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_under_development_message: {str(e)}"))

async def show_data_not_found_message(update: Update, context: ContextTypes.DEFAULT_TYPE, data_type: str):
    """Show data not found message"""
    try:
        await update.message.reply_text(
            f"📭 *Data Tidak Ditemukan*\n\n"
            f"Data {data_type} tidak tersedia saat ini.\n"
            "Silakan coba lagi nanti atau hubungi admin.",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Data not found message shown for {data_type}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_data_not_found_message: {str(e)}"))

async def show_invalid_input_message(update: Update, context: ContextTypes.DEFAULT_TYPE, expected_format: str):
    """Show invalid input message"""
    try:
        await update.message.reply_text(
            f"❌ *Input Tidak Valid*\n\n"
            f"Format yang diharapkan: {expected_format}\n"
            "Silakan periksa dan coba lagi.",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Invalid input message shown: {expected_format}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_invalid_input_message: {str(e)}"))

async def show_rate_limit_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show rate limit message"""
    try:
        await update.message.reply_text(
            "⏱️ *Batas Rate Tercapai*\n\n"
            "Anda telah mencapai batas maksimal permintaan.\n"
            "Silakan tunggu sebentar sebelum mencoba lagi.",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Rate limit message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_rate_limit_message: {str(e)}"))

async def show_timeout_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show timeout message"""
    try:
        await update.message.reply_text(
            "⏰ *Waktu Habis*\n\n"
            "Permintaan memakan waktu terlalu lama.\n"
            "Silakan coba lagi.",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Timeout message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_timeout_message: {str(e)}"))

async def show_network_error_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show network error message"""
    try:
        await update.message.reply_text(
            "🌐 *Kesalahan Jaringan*\n\n"
            "Tidak dapat terhubung ke server.\n"
            "Periksa koneksi internet Anda dan coba lagi.",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Network error message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_network_error_message: {str(e)}"))

async def show_database_error_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show database error message"""
    try:
        await update.message.reply_text(
            "💾 *Kesalahan Database*\n\n"
            "Terjadi kesalahan saat mengakses database.\n"
            "Silakan coba lagi nanti.",
            parse_mode="Markdown"
        )

        logger.info(safe_log("Database error message shown"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_database_error_message: {str(e)}"))

async def show_api_error_message(update: Update, context: ContextTypes.DEFAULT_TYPE, api_name: str):
    """Show API error message"""
    try:
        await update.message.reply_text(
            f"🔌 *Kesalahan API {api_name}*\n\n"
            f"Tidak dapat mengambil data dari {api_name}.\n"
            "Silakan coba lagi nanti.",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"API error message shown for {api_name}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_api_error_message: {str(e)}"))

async def show_fallback_message(update: Update, context: ContextTypes.DEFAULT_TYPE, original_error: str):
    """Show fallback message when all else fails"""
    try:
        await update.message.reply_text(
            "🔄 *Fallback Mode*\n\n"
            "Terjadi kesalahan yang tidak dikenal.\n"
            "Menggunakan mode fallback. Silakan coba lagi.",
            parse_mode="Markdown"
        )

        logger.info(safe_log(f"Fallback message shown for error: {original_error}"))

    except Exception as e:
        logger.error(safe_log(f"Error in show_fallback_message: {str(e)}"))

# Menu state management functions
def get_current_state(context: ContextTypes.DEFAULT_TYPE) -> MenuState:
    """Get current menu state"""
    try:
        state_str = context.user_data.get("menu_state", MenuState.MAIN_MENU.value)
        return MenuState(state_str)
    except Exception:
        return MenuState.MAIN_MENU

def set_menu_state(context: ContextTypes.DEFAULT_TYPE, state: MenuState):
    """Set menu state"""
    try:
        context.user_data["menu_state"] = state.value
        logger.debug(safe_log(f"Menu state set to {state.value}"))
    except Exception as e:
        logger.error(safe_log(f"Error setting menu state: {str(e)}"))

def clear_menu_state(context: ContextTypes.DEFAULT_TYPE):
    """Clear menu state"""
    try:
        context.user_data.pop("menu_state", None)
        logger.debug(safe_log("Menu state cleared"))
    except Exception as e:
        logger.error(safe_log(f"Error clearing menu state: {str(e)}"))

def get_pending_action(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
    """Get pending action"""
    try:
        return context.user_data.get("pending_action")
    except Exception:
        return None

def set_pending_action(context: ContextTypes.DEFAULT_TYPE, action: str):
    """Set pending action"""
    try:
        context.user_data["pending_action"] = action
        logger.debug(safe_log(f"Pending action set to {action}"))
    except Exception as e:
        logger.error(safe_log(f"Error setting pending action: {str(e)}"))

def clear_pending_action(context: ContextTypes.DEFAULT_TYPE):
    """Clear pending action"""
    try:
        context.user_data.pop("pending_action", None)
        logger.debug(safe_log("Pending action cleared"))
    except Exception as e:
        logger.error(safe_log(f"Error clearing pending action: {str(e)}"))

def get_explore_mode(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
    """Get explore mode"""
    try:
        return context.user_data.get("explore_mode")
    except Exception:
        return None

def set_explore_mode(context: ContextTypes.DEFAULT_TYPE, mode: str):
    """Set explore mode"""
    try:
        context.user_data["explore_mode"] = mode
        logger.debug(safe_log(f"Explore mode set to {mode}"))
    except Exception as e:
        logger.error(safe_log(f"Error setting explore mode: {str(e)}"))

def clear_explore_mode(context: ContextTypes.DEFAULT_TYPE):
    """Clear explore mode"""
    try:
        context.user_data.pop("explore_mode", None)
        logger.debug(safe_log("Explore mode cleared"))
    except Exception as e:
        logger.error(safe_log(f"Error clearing explore mode: {str(e)}"))

# Menu validation functions
def is_valid_menu_state(state: str) -> bool:
    """Check if state is valid menu state"""
    try:
        return state in [menu_state.value for menu_state in MenuState]
    except Exception:
        return False

def is_valid_period(period: str) -> bool:
    """Check if period is valid"""
    try:
        valid_periods = ["harian", "mingguan", "bulanan"]
        return period.lower() in valid_periods or period.isdigit()
    except Exception:
        return False

def is_valid_index(index: str) -> bool:
    """Check if index is valid"""
    try:
        from config import INDEX_STOCKS
        return index.upper() in INDEX_STOCKS
    except Exception:
        return False

def is_valid_ticker(ticker: str) -> bool:
    """Check if ticker is valid"""
    try:
        from config import INDEX_STOCKS
        for index_stocks in INDEX_STOCKS.values():
            if ticker.upper() in index_stocks:
                return True
        return False
    except Exception:
        return False

# Menu utility functions
def get_menu_breadcrumb(context: ContextTypes.DEFAULT_TYPE) -> str:
    """Get menu breadcrumb"""
    try:
        state = get_current_state(context)
        breadcrumbs = {
            MenuState.MAIN_MENU: "Menu Utama",
            MenuState.SUBMENU: "Dashboard > Menu Utama",
            MenuState.SAHAM: "Dashboard > Saham > Menu Utama",
            MenuState.CRYPTO: "Dashboard > Crypto > Menu Utama",
            MenuState.GLOBAL_MARKET: "Dashboard > Pasar Global > Menu Utama",
            MenuState.LAINNYA: "Dashboard > Lainnya > Menu Utama",
            MenuState.SETTINGS: "Pengaturan > Menu Utama",
            MenuState.ABOUT: "Tentang > Menu Utama",
            MenuState.HELP: "Bantuan > Menu Utama",
            MenuState.SUBSCRIPTION: "Langganan > Menu Utama",
            MenuState.JOIN_GROUP: "Bergabung Grup > Menu Utama"
        }
        return breadcrumbs.get(state, "Menu Utama")
    except Exception as e:
        logger.error(safe_log(f"Error getting breadcrumb: {str(e)}"))
        return "Menu Utama"

def get_menu_context_help(context: ContextTypes.DEFAULT_TYPE) -> str:
    """Get context-sensitive help"""
    try:
        state = get_current_state(context)
        help_messages = {
            MenuState.MAIN_MENU: "Pilih opsi dari menu utama untuk memulai.",
            MenuState.SUBMENU: "Pilih kategori untuk menjelajahi fitur bot.",
            MenuState.SAHAM: "Pilih opsi analisis saham yang tersedia.",
            MenuState.CRYPTO: "Pilih opsi untuk data cryptocurrency.",
            MenuState.GLOBAL_MARKET: "Pilih opsi untuk data pasar global.",
            MenuState.LAINNYA: "Pilih opsi lainnya yang tersedia."
        }
        return help_messages.get(state, "Gunakan tombol menu untuk navigasi.")
    except Exception as e:
        logger.error(safe_log(f"Error getting context help: {str(e)}"))
        return "Gunakan tombol menu untuk navigasi."

def validate_menu_transition(current_state: MenuState, target_state: MenuState) -> bool:
    """Validate menu state transition"""
    try:
        # Define valid transitions
        valid_transitions = {
            MenuState.MAIN_MENU: [MenuState.SUBMENU, MenuState.SETTINGS, MenuState.ABOUT, MenuState.HELP, MenuState.SUBSCRIPTION, MenuState.JOIN_GROUP],
            MenuState.SUBMENU: [MenuState.MAIN_MENU, MenuState.SAHAM, MenuState.CRYPTO, MenuState.GLOBAL_MARKET, MenuState.LAINNYA],
            MenuState.SAHAM: [MenuState.SUBMENU, MenuState.MAIN_MENU],
            MenuState.CRYPTO: [MenuState.SUBMENU, MenuState.MAIN_MENU],
            MenuState.GLOBAL_MARKET: [MenuState.SUBMENU, MenuState.MAIN_MENU],
            MenuState.LAINNYA: [MenuState.SUBMENU, MenuState.MAIN_MENU],
            MenuState.SETTINGS: [MenuState.MAIN_MENU],
            MenuState.ABOUT: [MenuState.MAIN_MENU],
            MenuState.HELP: [MenuState.MAIN_MENU],
            MenuState.SUBSCRIPTION: [MenuState.MAIN_MENU],
            MenuState.JOIN_GROUP: [MenuState.MAIN_MENU]
        }

        return target_state in valid_transitions.get(current_state, [])

    except Exception as e:
        logger.error(safe_log(f"Error validating menu transition: {str(e)}"))
        return False

# Export all functions
__all__ = [
    'show_main_menu', 'show_submenu', 'show_saham_menu', 'show_crypto_menu',
    'show_global_market_menu', 'show_lainnya_menu', 'show_explore_crypto_menu',
    'show_top_gainers_period_menu', 'show_top_losers_period_menu',
    'show_search_symbol_menu', 'show_technical_analysis_menu',
    'show_stock_list_menu', 'show_settings_menu', 'show_about_menu',
    'show_help_menu', 'show_subscription_menu', 'show_join_group_menu',
    'show_technical_analysis_submenu', 'show_stock_analysis_submenu',
    'show_index_heatmap_menu', 'show_period_selection_menu',
    'show_error_message', 'reset_to_main_menu', 'handle_menu_navigation',
    'show_loading_message', 'show_success_message', 'show_info_message',
    'show_warning_message', 'show_premium_required_message',
    'show_access_denied_message', 'show_under_development_message',
    'show_data_not_found_message', 'show_invalid_input_message',
    'show_rate_limit_message', 'show_timeout_message',
    'show_network_error_message', 'show_database_error_message',
    'show_api_error_message', 'show_fallback_message',
    'get_current_state', 'set_menu_state', 'clear_menu_state',
    'get_pending_action', 'set_pending_action', 'clear_pending_action',
    'get_explore_mode', 'set_explore_mode', 'clear_explore_mode',
    'is_valid_menu_state', 'is_valid_period', 'is_valid_index', 'is_valid_ticker',
    'get_menu_breadcrumb', 'get_menu_context_help', 'validate_menu_transition'
]