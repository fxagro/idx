"""
Handler functions for BJB Sekuritas Telegram Bot
Contains consolidated handlers and ConversationHandler
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler,
    ConversationHandler, ContextTypes, filters
)

from config import TOKEN, INDEX_STOCKS, INDICES
from enums import MenuState, SubscriptionType
from utils import safe_log, log_execution, require_access, handle_errors
from db_utils import (
    get_db_connection, check_user_access, get_user_subscription,
    add_to_watchlist, remove_from_watchlist, get_watchlist,
    add_price_alert, get_price_alerts, remove_price_alert
)
from menus import (
    show_main_menu, show_submenu, show_saham_menu, show_crypto_menu,
    show_global_market_menu, show_lainnya_menu, show_explore_crypto_menu,
    show_top_gainers_period_menu, show_top_losers_period_menu,
    show_search_symbol_menu, show_technical_analysis_menu,
    show_stock_list_menu, show_settings_menu, show_about_menu,
    show_help_menu, show_subscription_menu, show_join_group_menu,
    show_technical_analysis_submenu, show_stock_analysis_submenu,
    show_index_heatmap_menu, show_period_selection_menu,
    show_error_message, reset_to_main_menu, handle_menu_navigation,
    show_loading_message, show_success_message, show_info_message,
    show_warning_message, show_premium_required_message,
    show_access_denied_message, show_under_development_message,
    show_data_not_found_message, show_invalid_input_message,
    show_rate_limit_message, show_timeout_message,
    show_network_error_message, show_database_error_message,
    show_api_error_message, show_fallback_message,
    get_current_state, set_menu_state, clear_menu_state,
    get_pending_action, set_pending_action, clear_pending_action,
    get_explore_mode, set_explore_mode, clear_explore_mode,
    is_valid_menu_state, is_valid_period, is_valid_index, is_valid_ticker,
    get_menu_breadcrumb, get_menu_context_help, validate_menu_transition
)
from features_simple import (
    check_stock, top_gainers, top_losers, top_crypto, global_indices,
    commodity_prices, major_currencies, watch, unwatch, listwatch,
    technical_analysis, predict_stock, fundamental, signal,
    volatility, value_investing_analysis
)

# Setup logging
logger = logging.getLogger(__name__)

# Global application instance
application = None

# Conversation states
WAITING_FOR_INPUT, WAITING_FOR_CONFIRMATION = range(2)

def create_application() -> Application:
    """Create and configure the application"""
    global application

    # Create application
    application = Application.builder().token(TOKEN).build()

    # Add handlers in priority order
    setup_handlers()

    return application

def setup_handlers():
    """Setup all handlers for the application"""
    if not application:
        raise RuntimeError("Application not created. Call create_application() first.")

    # Priority 1: CallbackQueryHandler (for inline buttons)
    application.add_handler(CallbackQueryHandler(handle_callback_query))

    # Priority 2: ConversationHandler (for multi-step flows)
    application.add_handler(setup_crypto_exploration_handler())
    application.add_handler(setup_feedback_handler())
    application.add_handler(setup_subscription_handler())

    # Priority 3: CommandHandler (for commands)
    setup_command_handlers()

    # Priority 4: MessageHandler (for text input and menu navigation)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_input))

    # Priority 5: Error handler
    application.add_error_handler(error_handler)

def setup_command_handlers():
    """Setup command handlers"""
    # Main commands
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("menu", show_main_menu))
    application.add_handler(CommandHandler("h", help_command))
    application.add_handler(CommandHandler("help", help_command))

    # Stock analysis commands
    application.add_handler(CommandHandler("c", check_stock))
    application.add_handler(CommandHandler("s", screen_stock))
    application.add_handler(CommandHandler("p", percentage_change))
    application.add_handler(CommandHandler("screen", screen_percentage_change))
    application.add_handler(CommandHandler("ch", chart_stock))
    application.add_handler(CommandHandler("cb", candle_green))
    application.add_handler(CommandHandler("cm", candle_red))
    application.add_handler(CommandHandler("bar", bar))
    application.add_handler(CommandHandler("b", broker_activity))
    application.add_handler(CommandHandler("at", technical_analysis))
    application.add_handler(CommandHandler("af", fundamental))
    application.add_handler(CommandHandler("askbjbsekuritas", ask_bjb_sekuritas))
    application.add_handler(CommandHandler("signal", signal))
    application.add_handler(CommandHandler("predict", predict_stock))
    application.add_handler(CommandHandler("prediksi", predict_saham))
    application.add_handler(CommandHandler("lstm", predict_lstm))
    application.add_handler(CommandHandler("proyeksi", predict_rf))
    application.add_handler(CommandHandler("predik", predik))
    application.add_handler(CommandHandler("jurnal1", jurnal1))
    application.add_handler(CommandHandler("value", value_investing_analysis))
    application.add_handler(CommandHandler("update_fundamental", manual_update_fundamental))
    application.add_handler(CommandHandler("news", news))
    application.add_handler(CommandHandler("heatmap", correlation_heatmap))
    application.add_handler(CommandHandler("volatility", volatility))
    application.add_handler(CommandHandler("watch", watch))
    application.add_handler(CommandHandler("unwatch", unwatch))
    application.add_handler(CommandHandler("listwatch", listwatch))

    # Top gainers/losers commands
    application.add_handler(CommandHandler("tg", top_gainers))
    application.add_handler(CommandHandler("tgu", top_gainers_2024))
    application.add_handler(CommandHandler("tl", top_losers))
    application.add_handler(CommandHandler("tg100", top_gainers_kompas100))
    application.add_handler(CommandHandler("tl100", top_losers_kompas100))
    application.add_handler(CommandHandler("kompas100", list_kompas100))
    application.add_handler(CommandHandler("lq45", list_lq45))
    application.add_handler(CommandHandler("tg45", top_gainers_lq45))
    application.add_handler(CommandHandler("tgl", top_gainers_latest))
    application.add_handler(CommandHandler("tll", top_losers_latest))
    application.add_handler(CommandHandler("tvl", top_volume_latest))
    application.add_handler(CommandHandler("isp", idx_sector_performance))
    application.add_handler(CommandHandler("jii70", list_jii70))
    application.add_handler(CommandHandler("tg70", top_gainers_jii70))
    application.add_handler(CommandHandler("tl70", top_losers_jii70))
    application.add_handler(CommandHandler("list_sectors", list_sectors))
    application.add_handler(CommandHandler("tg_sector", top_gainers_sector))
    application.add_handler(CommandHandler("tl_sector", top_losers_sector))
    application.add_handler(CommandHandler("filter_eps", filter_eps_below_5))
    application.add_handler(CommandHandler("check_fundamental", check_fundamental))
    application.add_handler(CommandHandler("check_db", check_database))
    application.add_handler(CommandHandler("activate_subscription", activate_subscription))
    application.add_handler(CommandHandler("doji", doji))
    application.add_handler(CommandHandler("ih", index_change_heatmap))
    application.add_handler(CommandHandler("ih2", index_change_heatmap_custom))
    application.add_handler(CommandHandler("ig", global_indices))
    application.add_handler(CommandHandler("cp", commodity_prices))
    application.add_handler(CommandHandler("commodity_prices", commodity_prices))
    application.add_handler(CommandHandler("mc", major_currencies))
    application.add_handler(CommandHandler("major_currencies", major_currencies))
    application.add_handler(CommandHandler("tc", top_crypto))
    application.add_handler(CommandHandler("tgc", tgc_command))
    application.add_handler(CommandHandler("tgcd", tgc_command_date))
    application.add_handler(CommandHandler("tlcd", tlc_command_date))
    application.add_handler(CommandHandler("cmc", filter_top_coins))
    application.add_handler(CommandHandler("tlc", tlc_command))
    application.add_handler(CommandHandler("edu", education_menu))
    application.add_handler(CommandHandler("updatecmc", manual_update_cmc))
    application.add_handler(CommandHandler("tg_mbx", top_gainers_mbx))
    application.add_handler(CommandHandler("tl_mbx", top_losers_mbx))
    application.add_handler(CommandHandler("tg_issi", top_gainers_issi))
    application.add_handler(CommandHandler("tl_issi", top_losers_issi))
    application.add_handler(CommandHandler("check_index_data", check_index_data))
    application.add_handler(CommandHandler("ma_cross", ma_crossover))
    application.add_handler(CommandHandler("ma5_cross", ma5_cross))
    application.add_handler(CommandHandler("check_issi_data", check_issi_data))
    application.add_handler(CommandHandler("pg", price_graph))
    application.add_handler(CommandHandler("tp", tp))
    application.add_handler(CommandHandler("vp", vp))
    application.add_handler(CommandHandler("rp", rp))
    application.add_handler(CommandHandler("sa", sa))
    application.add_handler(CommandHandler("va", va))
    application.add_handler(CommandHandler("as", as_command))
    application.add_handler(CommandHandler("pg2", pg2))
    application.add_handler(CommandHandler("pg3", pg3))
    application.add_handler(CommandHandler("pg4", pg4))
    application.add_handler(CommandHandler("pg5", pg5))
    application.add_handler(CommandHandler("pg6", pg6))
    application.add_handler(CommandHandler("pg7", pg7))
    application.add_handler(CommandHandler("pg8", pg8))
    application.add_handler(CommandHandler("pg9", pg9))
    application.add_handler(CommandHandler("pg10", pg10))
    application.add_handler(CommandHandler("pg11", pg11))
    application.add_handler(CommandHandler("pgv", pgv))
    application.add_handler(CommandHandler("ic", crypto_indodax))
    application.add_handler(CommandHandler("v", significant_volume))
    application.add_handler(CommandHandler("v2", volume_compare))
    application.add_handler(CommandHandler("v3", volume_history))
    application.add_handler(CommandHandler("v4", significant_volume_all))
    application.add_handler(CommandHandler("v5", significant_volume_increase))
    application.add_handler(CommandHandler("tgmbx", top_gainers_mbx))
    application.add_handler(CommandHandler("tgissi", top_gainers_issi))
    application.add_handler(CommandHandler("tgcm", top_gainers_consecutive_movers))
    application.add_handler(CommandHandler("tgcmv", top_gainers_consecutive_movers_volume))
    application.add_handler(CommandHandler("tlcm", top_losers_consecutive_movers))
    application.add_handler(CommandHandler("tgf", top_gainers_filtered))
    application.add_handler(CommandHandler("tlf", top_losers_filtered))
    application.add_handler(CommandHandler("bb", bottom_bollinger_bands))
    application.add_handler(CommandHandler("bbl", bbl_filter))
    application.add_handler(CommandHandler("bbh1", bbh1))
    application.add_handler(CommandHandler("bbh2", bbh2))
    application.add_handler(CommandHandler("bbma5", bottom_bollinger_ma5_crossover))
    application.add_handler(CommandHandler("ff", ff_filter))
    application.add_handler(CommandHandler("sim", sim))
    application.add_handler(CommandHandler("bym", buy_simulation_db))
    application.add_handler(CommandHandler("buys", buy_single_stock))
    application.add_handler(CommandHandler("beli", buy_market))
    application.add_handler(CommandHandler("jual", sell_market))
    application.add_handler(CommandHandler("buy", buy_stock))
    application.add_handler(CommandHandler("lap", report_status))
    application.add_handler(CommandHandler("sell", sell_stock))
    application.add_handler(CommandHandler("alap", analyze_report))
    application.add_handler(CommandHandler("alap1", analyze_report_date))
    application.add_handler(CommandHandler("be", buy_stock1))
    application.add_handler(CommandHandler("belisemua", beli_semua))
    application.add_handler(CommandHandler("la", report_status1))
    application.add_handler(CommandHandler("ju", sell_stock1))
    application.add_handler(CommandHandler("al", analyze_report1))
    application.add_handler(CommandHandler("alm", analyze_report3))
    application.add_handler(CommandHandler("alre", analyze_report4))
    application.add_handler(CommandHandler("alru", analyze_report5))
    application.add_handler(CommandHandler("alra", analyze_report6))
    application.add_handler(CommandHandler("alr", analyze_report7))
    application.add_handler(CommandHandler("ald", analyze_report2))
    application.add_handler(CommandHandler("ala", analyze_report_date1))
    application.add_handler(CommandHandler("alg", analyze_report_image))
    application.add_handler(CommandHandler("akun", select_account))
    application.add_handler(CommandHandler("sal", check_balance))
    application.add_handler(CommandHandler("bi", buy_index))
    application.add_handler(CommandHandler("la", analyze_report_index))
    application.add_handler(CommandHandler("juall", sell_all))
    application.add_handler(CommandHandler("tgv", top_gainers_by_volume))
    application.add_handler(CommandHandler("hvb", high_volume_breakout))
    application.add_handler(CommandHandler("hvbd", high_volume_breakout_by_date))
    application.add_handler(CommandHandler("reset", reset_accounts))
    application.add_handler(CommandHandler("extract_pdf_data", extract_pdf_data))
    application.add_handler(CommandHandler("update_daily_achievement", update_daily_achievement))
    application.add_handler(CommandHandler("view_achievement", view_achievement))
    application.add_handler(CommandHandler("update_daily_achievement", update_daily_achievement))
    application.add_handler(CommandHandler("get_achievement", get_achievement_data))
    application.add_handler(CommandHandler("process_latest_pdf", process_latest_pdf))

def setup_crypto_exploration_handler() -> ConversationHandler:
    """Setup conversation handler for crypto exploration"""
    return ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^(Eksplorasi Crypto)$"), handle_crypto_exploration_entry)],
        states={
            WAITING_FOR_INPUT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_crypto_exploration_input)
            ],
        },
        fallbacks=[
            MessageHandler(filters.Regex("^(⬅️ Kembali ke Menu Crypto)$"), handle_crypto_exploration_cancel),
            CommandHandler("cancel", handle_crypto_exploration_cancel)
        ],
        per_message=True
    )

def setup_feedback_handler() -> ConversationHandler:
    """Setup conversation handler for feedback"""
    return ConversationHandler(
        entry_points=[CommandHandler("feedback", handle_feedback_start)],
        states={
            WAITING_FOR_INPUT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_feedback_input)
            ],
        },
        fallbacks=[
            CommandHandler("cancel", handle_feedback_cancel)
        ],
        per_message=True
    )

def setup_subscription_handler() -> ConversationHandler:
    """Setup conversation handler for subscription"""
    return ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^(💳 Langganan)$"), handle_subscription_entry)],
        states={
            WAITING_FOR_CONFIRMATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_subscription_confirmation)
            ],
        },
        fallbacks=[
            CommandHandler("cancel", handle_subscription_cancel)
        ],
        per_message=True
    )

# Handler functions
@log_execution
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    await show_main_menu(update, context)

@log_execution
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle help command"""
    await show_help_menu(update, context)

@log_execution
async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle callback queries from inline buttons"""
    query = update.callback_query
    await query.answer()

    try:
        callback_data = query.data
        logger.info(safe_log(f"Callback received: {callback_data} from user {query.from_user.id}"))

        # Handle different callback patterns
        if callback_data.startswith('top_gainers_'):
            index = callback_data.split('_')[-1]
            await handle_top_gainers_callback(update, context, index)

        elif callback_data.startswith('top_losers_'):
            index = callback_data.split('_')[-1]
            await handle_top_losers_callback(update, context, index)

        elif callback_data.startswith(('lq45_', 'kompas100_', 'jii70_', 'mbx_', 'issi_')):
            parts = callback_data.split('_')
            index = parts[0]
            ticker = parts[1]
            await show_stock_analysis_submenu(update, context, ticker, index)

        elif callback_data in ['menu_utama', 'about', 'help', 'join_group']:
            await show_under_development_message(update, context, callback_data)

        elif callback_data == 'subscription':
            await show_subscription_menu(update, context)

        elif callback_data == 'back_to_menu':
            await reset_to_main_menu(update, context)

        elif callback_data == 'edu_start' or callback_data.startswith('edu_'):
            await handle_education_callback(update, context, callback_data)

        elif callback_data.startswith('show_chart_'):
            await handle_chart_button(update, context)

        elif callback_data.startswith('c_') or callback_data.startswith('at_') or callback_data.startswith('signal_') or callback_data.startswith('predict_') or callback_data.startswith('af_'):
            action, ticker = callback_data.split('_', 1)
            await handle_stock_action_callback(update, context, action, ticker)

        elif callback_data.startswith('p_'):
            parts = callback_data.split('_')
            ticker = parts[1]
            days = parts[2]
            await handle_percentage_change_callback(update, context, ticker, days)

        elif callback_data.startswith('ma5_') or callback_data.startswith('ma20_') or callback_data.startswith('ma50_') or callback_data.startswith('ma100_') or callback_data.startswith('ma200_'):
            parts = callback_data.split('_')
            indicator = parts[0]
            ticker = parts[1]
            await handle_technical_indicator_callback(update, context, indicator, ticker)

        elif callback_data.startswith('tg_') or callback_data.startswith('tl_'):
            await handle_top_gainers_losers_callback(update, context, callback_data)

        elif callback_data.startswith('ch_'):
            ticker = callback_data.split('_')[1]
            await handle_chart_callback(update, context, ticker)

        elif callback_data.startswith('list_'):
            list_type = callback_data.split('_')[1]
            await handle_list_callback(update, context, list_type)

        elif callback_data == "doji_menu":
            await handle_doji_menu_callback(update, context)

        elif callback_data.startswith("doji_"):
            index = callback_data.split('_')[1]
            await handle_doji_callback(update, context, index)

        elif callback_data.startswith("show_doji_chart_"):
            parts = callback_data.split('_')
            ticker = parts[3]
            target_date = parts[4]
            await handle_doji_chart_callback(update, context, ticker, target_date)

        elif callback_data.startswith('at_'):
            ticker = callback_data.split('_')[1]
            await show_technical_analysis_submenu(update, context, ticker)

        elif callback_data.startswith('tg45_') or callback_data.startswith('tl45_'):
            ticker = callback_data.split('_')[1]
            await handle_lq45_callback(update, context, callback_data)

        elif callback_data.startswith('tg100_') or callback_data.startswith('tl100_'):
            ticker = callback_data.split('_')[1]
            await handle_kompas100_callback(update, context, callback_data)

        elif callback_data.startswith('jii70_'):
            ticker = callback_data.split('_')[1]
            await handle_jii70_callback(update, context, callback_data)

        elif callback_data.startswith('tg70_') or callback_data.startswith('tl70_'):
            ticker = callback_data.split('_')[1]
            await handle_jii70_callback(update, context, callback_data)

        elif callback_data.startswith('tgsector_') or callback_data.startswith('tlsector_'):
            ticker = callback_data.split('_')[1]
            await handle_sector_callback(update, context, callback_data)

        elif callback_data.startswith('bar_'):
            ticker = callback_data.split('_')[1]
            await handle_bar_callback(update, context, ticker)

        elif callback_data.startswith('value_'):
            ticker = callback_data.split('_')[1]
            await handle_value_callback(update, context, ticker)

        elif callback_data == 'c':
            await update.message.reply_text("Masukkan kode saham, contoh: /c BJBR")

        elif callback_data == 'a':
            await update.message.reply_text("Masukkan kode saham, contoh: /bar BJBR")

        elif callback_data == 'signal':
            await update.message.reply_text("Masukkan kode saham, contoh: /signal BJBR")

        elif callback_data == 'predict':
            await update.message.reply_text("Masukkan kode saham, contoh: /predict BJBR")

        elif callback_data == 'fundamental':
            await update.message.reply_text("Masukkan kode saham, contoh: /af BJBR")

        elif callback_data == 'tg':
            await update.message.reply_text("Masukkan periode, contoh: /tg harian")

        elif callback_data == 'tl':
            await update.message.reply_text("Masukkan periode, contoh: /tl harian")

        elif callback_data.startswith('show_ma5_chart_'):
            _, _, ticker, date = callback_data.split("_", 3)
            await handle_ma5_chart_callback(update, context, ticker, date)

        elif callback_data.startswith("show_ma_chart_"):
            _, _, ticker, date = callback_data.split("_", 3)
            await handle_ma_chart_callback(update, context, ticker, date)

        elif callback_data == 'edu_start' or callback_data.startswith('edu_'):
            await handle_education_callback(update, context, callback_data)

        elif callback_data == 'back_to_menu':
            await reset_to_main_menu(update, context)

        else:
            logger.warning(safe_log(f"Unrecognized callback: {callback_data} from user {query.from_user.id}"))
            await query.message.reply_text(f"Aksi {callback_data} tidak dikenali.")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_callback_query: {str(e)}"))
        await query.message.reply_text(f"Terjadi kesalahan: {str(e)}")

@log_execution
async def handle_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input based on current state"""
    try:
        user_choice = update.message.text.strip()
        current_state = get_current_state(context)

        logger.info(safe_log(f"Text input received: {user_choice} in state {current_state.value}"))

        # Handle pending actions first
        pending_action = get_pending_action(context)
        if pending_action:
            await handle_pending_action(update, context, user_choice, pending_action)
            return

        # Handle explore mode
        explore_mode = get_explore_mode(context)
        if explore_mode:
            await handle_explore_input(update, context, user_choice, explore_mode)
            return

        # Handle menu navigation based on current state
        if current_state == MenuState.MAIN_MENU:
            await handle_main_menu_input(update, context, user_choice)
        elif current_state == MenuState.SUBMENU:
            await handle_submenu_input(update, context, user_choice)
        elif current_state == MenuState.SAHAM:
            await handle_saham_menu_input(update, context, user_choice)
        elif current_state == MenuState.CRYPTO:
            await handle_crypto_menu_input(update, context, user_choice)
        elif current_state == MenuState.GLOBAL_MARKET:
            await handle_global_market_menu_input(update, context, user_choice)
        elif current_state == MenuState.LAINNYA:
            await handle_lainnya_menu_input(update, context, user_choice)
        else:
            await handle_main_menu_input(update, context, user_choice)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_text_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input teks")

# Pending action handlers
async def handle_pending_action(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str, action: str):
    """Handle pending actions"""
    try:
        if user_choice == "⬅️ Kembali ke Menu Saham":
            clear_pending_action(context)
            await show_saham_menu(update, context)
            return

        if action == "top_gainers":
            period = user_choice.lower()
            clear_pending_action(context)
            context.args = [period]
            await top_gainers(update, context)
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)

        elif action == "top_losers":
            period = user_choice.lower()
            clear_pending_action(context)
            context.args = [period]
            await top_losers(update, context)
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)

        else:
            await update.message.reply_text(
                "Silakan pilih periode yang tersedia (harian/mingguan).",
                parse_mode="Markdown"
            )

    except Exception as e:
        logger.error(safe_log(f"Error in handle_pending_action: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses aksi tertunda")

# Explore input handlers
async def handle_explore_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str, mode: str):
    """Handle explore mode input"""
    try:
        if user_choice == "⬅️ Kembali ke Menu Crypto":
            clear_explore_mode(context)
            await show_crypto_menu(update, context)
            return

        if mode == "search_symbol":
            if user_choice.upper() == "CANCEL":
                clear_explore_mode(context)
                await show_explore_crypto_menu(update, context)
                return

            # Handle crypto search
            context.args = [user_choice]
            await handle_crypto_price_search(update, context)
            clear_explore_mode(context)
            await show_explore_crypto_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_explore_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input eksplorasi")

# Menu input handlers
async def handle_main_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle main menu input"""
    try:
        if user_choice == "📊 Dashboard":
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)
        elif user_choice == "👤 Setting":
            await show_settings_menu(update, context)
        elif user_choice == "🏢 About BJB Sekuritas":
            await show_about_menu(update, context)
        elif user_choice == "❓ Help":
            await show_help_menu(update, context)
        elif user_choice == "💳 Langganan":
            await show_subscription_menu(update, context)
        elif user_choice == "👥 Join Group":
            await show_join_group_menu(update, context)
        elif user_choice in ["Pengaturan", "Profil"]:
            await show_under_development_message(update, context, user_choice)
            await show_main_menu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari menu utama yang tersedia.",
                parse_mode="Markdown"
            )
            await show_main_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_main_menu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input menu utama")

async def handle_submenu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle submenu input"""
    try:
        if user_choice == "📈 Saham":
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "💰 Crypto":
            set_menu_state(context, MenuState.CRYPTO)
            await show_crypto_menu(update, context)
        elif user_choice == "🌍 Pasar Global":
            set_menu_state(context, MenuState.GLOBAL_MARKET)
            await show_global_market_menu(update, context)
        elif user_choice == "⚙️ Lainnya":
            set_menu_state(context, MenuState.LAINNYA)
            await show_lainnya_menu(update, context)
        elif user_choice == "⬅️ Kembali ke Menu Utama":
            set_menu_state(context, MenuState.MAIN_MENU)
            await show_main_menu(update, context)
        elif user_choice in ["Dashboard", "Pengaturan", "Profil"]:
            if user_choice == "Dashboard":
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
            else:
                await show_under_development_message(update, context, user_choice)
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari submenu yang tersedia.",
                parse_mode="Markdown"
            )
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_submenu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input submenu")

async def handle_saham_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle saham menu input"""
    try:
        if user_choice == "Saham LQ45":
            await handle_lq45_list(update, context)
        elif user_choice == "Saham JII70":
            await handle_jii70_list(update, context)
        elif user_choice == "Saham KOMPAS100":
            await handle_kompas100_list(update, context)
        elif user_choice == "Top Gainers":
            await show_top_gainers_period_menu(update, context)
        elif user_choice == "Top Losers":
            await show_top_losers_period_menu(update, context)
        elif user_choice == "Heatmap Indeks":
            await show_index_heatmap_menu(update, context)
        elif user_choice == "Analisis Teknikal":
            await show_under_development_message(update, context, "Analisis Teknikal")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "Analisis Fundamental":
            await show_under_development_message(update, context, "Analisis Fundamental")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "Sinyal Trading":
            await show_under_development_message(update, context, "Sinyal Trading")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "Value Investing":
            await show_under_development_message(update, context, "Value Investing")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "Volatilitas":
            await show_under_development_message(update, context, "Volatilitas")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "Daftar Pantauan":
            await show_under_development_message(update, context, "Daftar Pantauan")
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)
        elif user_choice == "⬅️ Kembali ke Submenu":
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)
        elif user_choice in ["Dashboard", "AI BJB Sekuritas", "Profil"]:
            if user_choice == "Dashboard":
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
            else:
                await show_under_development_message(update, context, user_choice)
                set_menu_state(context, MenuState.SAHAM)
                await show_saham_menu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari menu Saham yang tersedia.",
                parse_mode="Markdown"
            )
            set_menu_state(context, MenuState.SAHAM)
            await show_saham_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_saham_menu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input menu saham")

async def handle_crypto_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle crypto menu input"""
    try:
        if user_choice == "Top 10 Crypto":
            await top_crypto(update, context)
            set_menu_state(context, MenuState.CRYPTO)
            await show_crypto_menu(update, context)
        elif user_choice == "Eksplorasi Crypto":
            set_menu_state(context, MenuState.CRYPTO)
            await show_explore_crypto_menu(update, context)
        elif user_choice == "⬅️ Kembali ke Submenu":
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)
        elif user_choice in ["Dashboard", "Pengaturan", "Profil"]:
            if user_choice == "Dashboard":
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
            else:
                await show_under_development_message(update, context, user_choice)
                set_menu_state(context, MenuState.CRYPTO)
                await show_crypto_menu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari menu Crypto yang tersedia.",
                parse_mode="Markdown"
            )
            set_menu_state(context, MenuState.CRYPTO)
            await show_crypto_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_crypto_menu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input menu crypto")

async def handle_global_market_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle global market menu input"""
    try:
        if user_choice == "Indeks Global":
            await global_indices(update, context)
            set_menu_state(context, MenuState.GLOBAL_MARKET)
            await show_global_market_menu(update, context)
        elif user_choice == "Komoditas":
            await commodity_prices(update, context)
            set_menu_state(context, MenuState.GLOBAL_MARKET)
            await show_global_market_menu(update, context)
        elif user_choice == "Major Currencies":
            await major_currencies(update, context)
            set_menu_state(context, MenuState.GLOBAL_MARKET)
            await show_global_market_menu(update, context)
        elif user_choice == "⬅️ Kembali ke Submenu":
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)
        elif user_choice in ["Dashboard", "Pengaturan", "Profil"]:
            if user_choice == "Dashboard":
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
            else:
                await show_under_development_message(update, context, user_choice)
                set_menu_state(context, MenuState.GLOBAL_MARKET)
                await show_global_market_menu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari menu Pasar Global yang tersedia.",
                parse_mode="Markdown"
            )
            set_menu_state(context, MenuState.GLOBAL_MARKET)
            await show_global_market_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_global_market_menu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input menu pasar global")

async def handle_lainnya_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE, user_choice: str):
    """Handle lainnya menu input"""
    try:
        if user_choice == "Langganan":
            await show_subscription_menu(update, context)
            set_menu_state(context, MenuState.LAINNYA)
            await show_lainnya_menu(update, context)
        elif user_choice == "Feedback":
            await show_under_development_message(update, context, "Feedback")
            set_menu_state(context, MenuState.LAINNYA)
            await show_lainnya_menu(update, context)
        elif user_choice == "⬅️ Kembali ke Submenu":
            set_menu_state(context, MenuState.SUBMENU)
            await show_submenu(update, context)
        elif user_choice in ["Dashboard", "Pengaturan", "Profil"]:
            if user_choice == "Dashboard":
                set_menu_state(context, MenuState.SUBMENU)
                await show_submenu(update, context)
            else:
                await show_under_development_message(update, context, user_choice)
                set_menu_state(context, MenuState.LAINNYA)
                await show_lainnya_menu(update, context)
        else:
            await update.message.reply_text(
                "Silakan pilih opsi dari menu Lainnya yang tersedia.",
                parse_mode="Markdown"
            )
            set_menu_state(context, MenuState.LAINNYA)
            await show_lainnya_menu(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_lainnya_menu_input: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses input menu lainnya")

# Callback handlers
async def handle_top_gainers_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, index: str):
    """Handle top gainers callback"""
    try:
        if index == 'lq45':
            await top_gainers_lq45(update, context)
        elif index == 'kompas100':
            await top_gainers_kompas100(update, context)
        elif index == 'jii70':
            await top_gainers_jii70(update, context)
        elif index == 'mbx':
            await top_gainers_mbx(update, context)
        elif index == 'issi':
            await top_gainers_issi(update, context)
        else:
            await update.callback_query.message.reply_text(f"Indeks {index} tidak dikenali.")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_top_gainers_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback top gainers")

async def handle_top_losers_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, index: str):
    """Handle top losers callback"""
    try:
        if index == 'lq45':
            await top_losers_lq45(update, context)
        elif index == 'kompas100':
            await top_losers_kompas100(update, context)
        elif index == 'jii70':
            await top_losers_jii70(update, context)
        elif index == 'mbx':
            await top_losers_mbx(update, context)
        elif index == 'issi':
            await top_losers_issi(update, context)
        else:
            await update.callback_query.message.reply_text(f"Indeks {index} tidak dikenali.")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_top_losers_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback top losers")

async def handle_stock_action_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, action: str, ticker: str):
    """Handle stock action callbacks"""
    try:
        new_update = Update(update.update_id, message=update.callback_query.message, callback_query=None)
        context.args = [ticker]

        if action == 'c':
            await check_stock(new_update, context)
        elif action == 'at':
            await technical_analysis(new_update, context)
        elif action == 'signal':
            await signal(new_update, context)
        elif action == 'predict':
            await predict_stock(new_update, context)
        elif action == 'af':
            await fundamental(new_update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_stock_action_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses aksi saham")

async def handle_technical_indicator_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, indicator: str, ticker: str):
    """Handle technical indicator callbacks"""
    try:
        # This would call the specific technical indicator function
        # For now, show under development message
        await show_under_development_message(update, context, f"Indikator {indicator}")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_technical_indicator_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses indikator teknikal")

async def handle_top_gainers_losers_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle top gainers/losers callbacks"""
    try:
        # This would call the specific top gainers/losers function
        # For now, show under development message
        await show_under_development_message(update, context, "Top Gainers/Losers detail")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_top_gainers_losers_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses top gainers/losers")

async def handle_chart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str):
    """Handle chart callbacks"""
    try:
        new_update = Update(update.update_id, message=update.callback_query.message, callback_query=None)
        context.args = [ticker]
        await chart_stock(new_update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_chart_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart")

async def handle_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, list_type: str):
    """Handle list callbacks"""
    try:
        if list_type == 'kompas100':
            await list_kompas100(update, context)
        elif list_type == 'lq45':
            await list_lq45(update, context)
        elif list_type == 'jii70':
            await list_jii70(update, context)
        elif list_type == 'sectors':
            await list_sectors(update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_list_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses daftar")

async def handle_doji_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle doji menu callback"""
    try:
        await show_under_development_message(update, context, "Menu Doji")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_doji_menu_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses menu doji")

async def handle_doji_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, index: str):
    """Handle doji callback"""
    try:
        new_update = Update(update.update_id, message=update.callback_query.message, callback_query=None)
        context.args = [index]
        await doji(new_update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_doji_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses doji")

async def handle_doji_chart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str, target_date: str):
    """Handle doji chart callback"""
    try:
        await show_under_development_message(update, context, "Chart Doji")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_doji_chart_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart doji")

async def handle_lq45_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle LQ45 callbacks"""
    try:
        ticker = callback_data.split('_')[1]
        await show_stock_analysis_submenu(update, context, ticker, 'lq45')

    except Exception as e:
        logger.error(safe_log(f"Error in handle_lq45_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback LQ45")

async def handle_kompas100_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle KOMPAS100 callbacks"""
    try:
        ticker = callback_data.split('_')[1]
        await show_stock_analysis_submenu(update, context, ticker, 'kompas100')

    except Exception as e:
        logger.error(safe_log(f"Error in handle_kompas100_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback KOMPAS100")

async def handle_jii70_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle JII70 callbacks"""
    try:
        ticker = callback_data.split('_')[1]
        await show_stock_analysis_submenu(update, context, ticker, 'jii70')

    except Exception as e:
        logger.error(safe_log(f"Error in handle_jii70_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback JII70")

async def handle_sector_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle sector callbacks"""
    try:
        ticker = callback_data.split('_')[1]
        await show_stock_analysis_submenu(update, context, ticker, 'sector')

    except Exception as e:
        logger.error(safe_log(f"Error in handle_sector_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses callback sektor")

async def handle_bar_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str):
    """Handle bar chart callback"""
    try:
        new_update = Update(update.update_id, message=update.callback_query.message, callback_query=None)
        context.args = [ticker]
        await bar(new_update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_bar_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat bar chart")

async def handle_value_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str):
    """Handle value investing callback"""
    try:
        await show_under_development_message(update, context, f"Value Investing untuk {ticker}")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_value_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses value investing")

async def handle_ma5_chart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str, date: str):
    """Handle MA5 chart callback"""
    try:
        await show_under_development_message(update, context, "Chart MA5")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_ma5_chart_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart MA5")

async def handle_ma_chart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str, date: str):
    """Handle MA chart callback"""
    try:
        await show_under_development_message(update, context, "Chart MA")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_ma_chart_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart MA")

async def handle_education_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, callback_data: str):
    """Handle education callbacks"""
    try:
        await show_under_development_message(update, context, "Edukasi")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_education_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal memproses edukasi")

async def handle_chart_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle chart button callback"""
    try:
        await show_under_development_message(update, context, "Chart")

    except Exception as e:
        logger.error(safe_log(f"Error in handle_chart_button: {str(e)}"))
        await show_error_message(update, context, "Gagal membuat chart")

async def handle_percentage_change_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str, days: str):
    """Handle percentage change callback"""
    try:
        new_update = Update(update.update_id, message=update.callback_query.message, callback_query=None)
        context.args = [ticker, days]
        await percentage_change(new_update, context)

    except Exception as e:
        logger.error(safe_log(f"Error in handle_percentage_change_callback: {str(e)}"))
        await show_error_message(update, context, "Gagal menghitung persentase perubahan")

# Conversation handlers
async def handle_crypto_exploration_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle crypto exploration entry"""
    await show_explore_crypto_menu(update, context)
    return WAITING_FOR_INPUT

async def handle_crypto_exploration_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle crypto exploration input"""
    user_choice = update.message.text.strip()
    await handle_explore_input(update, context, user_choice, "explore")
    return WAITING_FOR_INPUT

async def handle_crypto_exploration_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle crypto exploration cancel"""
    clear_explore_mode(context)
    await show_crypto_menu(update, context)
    return ConversationHandler.END

async def handle_feedback_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle feedback start"""
    keyboard = [
        [
            InlineKeyboardButton("⭐ 1", callback_data="rating:1"),
            InlineKeyboardButton("⭐ 2", callback_data="rating:2"),
            InlineKeyboardButton("⭐ 3", callback_data="rating:3"),
            InlineKeyboardButton("⭐ 4", callback_data="rating:4"),
            InlineKeyboardButton("⭐ 5", callback_data="rating:5"),
        ],
        [InlineKeyboardButton("Batal", callback_data="cancel")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "Beri rating untuk bot ini (1-5 bintang):",
        reply_markup=reply_markup
    )
    return WAITING_FOR_INPUT

async def handle_feedback_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle feedback input"""
    try:
        user_id = update.effective_user.id
        feedback = update.message.text.strip()

        if len(feedback) > 100:
            await update.message.reply_text(
                "Feedback terlalu panjang (maks. 100 karakter). Silakan coba lagi."
            )
            return WAITING_FOR_INPUT

        # Save feedback to database
        from db_utils import add_feedback
        await add_feedback(user_id, context.user_data.get("rating", 0), feedback)

        await update.message.reply_text(
            "Terima kasih atas feedback Anda! Kami akan gunakan untuk meningkatkan layanan."
        )

        context.user_data.clear()

    except Exception as e:
        logger.error(safe_log(f"Error in handle_feedback_input: {str(e)}"))
        await update.message.reply_text("Terjadi kesalahan saat menyimpan feedback.")

    return ConversationHandler.END

async def handle_feedback_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle feedback cancel"""
    await update.message.reply_text("Proses feedback dibatalkan.")
    return ConversationHandler.END

async def handle_subscription_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle subscription entry"""
    await show_subscription_menu(update, context)
    return WAITING_FOR_CONFIRMATION

async def handle_subscription_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle subscription confirmation"""
    await show_under_development_message(update, context, "Konfirmasi Langganan")
    return ConversationHandler.END

async def handle_subscription_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle subscription cancel"""
    await show_main_menu(update, context)
    return ConversationHandler.END

# Error handler
async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors"""
    logger.error(safe_log(f"Update {update} caused error: {context.error}"))

    if update and update.effective_chat:
        await context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="Terjadi kesalahan saat memproses perintah Anda. Silakan coba lagi nanti."
        )

# Placeholder functions for features that need implementation
async def handle_crypto_price_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle crypto price search"""
    await show_under_development_message(update, context, "Pencarian Crypto")

async def handle_lq45_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle LQ45 list"""
    await show_under_development_message(update, context, "Daftar LQ45")

async def handle_jii70_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle JII70 list"""
    await show_under_development_message(update, context, "Daftar JII70")

async def handle_kompas100_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle KOMPAS100 list"""
    await show_under_development_message(update, context, "Daftar KOMPAS100")

# Import required functions from features
from features_simple import (
    check_stock, top_gainers, top_losers, top_crypto, global_indices,
    commodity_prices, major_currencies, watch, unwatch, listwatch
)

# Placeholder functions for missing features
async def percentage_change(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Percentage change (placeholder)"""
    await show_under_development_message(update, context, "Percentage Change")

async def chart_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Chart stock (placeholder)"""
    await show_under_development_message(update, context, "Chart Stock")

async def candle_green(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Candle green (placeholder)"""
    await show_under_development_message(update, context, "Candle Green")

async def candle_red(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Candle red (placeholder)"""
    await show_under_development_message(update, context, "Candle Red")

async def bar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bar chart (placeholder)"""
    await show_under_development_message(update, context, "Bar Chart")

async def broker_activity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Broker activity (placeholder)"""
    await show_under_development_message(update, context, "Broker Activity")

async def technical_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Technical analysis (placeholder)"""
    await show_under_development_message(update, context, "Technical Analysis")

async def predict_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Predict stock (placeholder)"""
    await show_under_development_message(update, context, "Predict Stock")

async def fundamental(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fundamental analysis (placeholder)"""
    await show_under_development_message(update, context, "Fundamental Analysis")

async def signal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Signal (placeholder)"""
    await show_under_development_message(update, context, "Signal")

async def volatility(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Volatility (placeholder)"""
    await show_under_development_message(update, context, "Volatility")

async def value_investing_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Value investing analysis (placeholder)"""
    await show_under_development_message(update, context, "Value Investing Analysis")

async def doji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Doji (placeholder)"""
    await show_under_development_message(update, context, "Doji")

async def list_kompas100(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List KOMPAS100 (placeholder)"""
    await show_under_development_message(update, context, "List KOMPAS100")

async def list_lq45(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List LQ45 (placeholder)"""
    await show_under_development_message(update, context, "List LQ45")

async def list_jii70(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List JII70 (placeholder)"""
    await show_under_development_message(update, context, "List JII70")

async def list_sectors(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List sectors (placeholder)"""
    await show_under_development_message(update, context, "List Sectors")

async def top_gainers_lq45(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers LQ45 (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers LQ45")

async def top_losers_lq45(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers LQ45 (placeholder)"""
    await show_under_development_message(update, context, "Top Losers LQ45")

async def top_gainers_kompas100(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers KOMPAS100 (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers KOMPAS100")

async def top_losers_kompas100(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers KOMPAS100 (placeholder)"""
    await show_under_development_message(update, context, "Top Losers KOMPAS100")

async def top_gainers_jii70(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers JII70 (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers JII70")

async def top_losers_jii70(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers JII70 (placeholder)"""
    await show_under_development_message(update, context, "Top Losers JII70")

async def top_gainers_mbx(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers MBX (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers MBX")

async def top_losers_mbx(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers MBX (placeholder)"""
    await show_under_development_message(update, context, "Top Losers MBX")

async def top_gainers_issi(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers ISSI (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers ISSI")

async def top_losers_issi(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers ISSI (placeholder)"""
    await show_under_development_message(update, context, "Top Losers ISSI")

async def top_gainers_sector(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers sector (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers Sector")

async def top_losers_sector(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers sector (placeholder)"""
    await show_under_development_message(update, context, "Top Losers Sector")

async def top_gainers_latest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers latest (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers Latest")

async def top_losers_latest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers latest (placeholder)"""
    await show_under_development_message(update, context, "Top Losers Latest")

async def top_volume_latest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top volume latest (placeholder)"""
    await show_under_development_message(update, context, "Top Volume Latest")

async def idx_sector_performance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """IDX sector performance (placeholder)"""
    await show_under_development_message(update, context, "IDX Sector Performance")

async def filter_eps_below_5(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Filter EPS below 5 (placeholder)"""
    await show_under_development_message(update, context, "Filter EPS")

async def check_fundamental(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check fundamental (placeholder)"""
    await show_under_development_message(update, context, "Check Fundamental")

async def check_database(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check database (placeholder)"""
    await show_under_development_message(update, context, "Check Database")

async def activate_subscription(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Activate subscription (placeholder)"""
    await show_under_development_message(update, context, "Activate Subscription")

async def index_change_heatmap(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Index change heatmap (placeholder)"""
    await show_under_development_message(update, context, "Index Change Heatmap")

async def index_change_heatmap_custom(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Index change heatmap custom (placeholder)"""
    await show_under_development_message(update, context, "Index Change Heatmap Custom")

async def tgc_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """TGC command (placeholder)"""
    await show_under_development_message(update, context, "TGC Command")

async def tgc_command_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """TGC command date (placeholder)"""
    await show_under_development_message(update, context, "TGC Command Date")

async def tlc_command_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """TLC command date (placeholder)"""
    await show_under_development_message(update, context, "TLC Command Date")

async def filter_top_coins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Filter top coins (placeholder)"""
    await show_under_development_message(update, context, "Filter Top Coins")

async def tlc_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """TLC command (placeholder)"""
    await show_under_development_message(update, context, "TLC Command")

async def education_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Education menu (placeholder)"""
    await show_under_development_message(update, context, "Education Menu")

async def manual_update_cmc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manual update CMC (placeholder)"""
    await show_under_development_message(update, context, "Manual Update CMC")

async def check_index_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check index data (placeholder)"""
    await show_under_development_message(update, context, "Check Index Data")

async def ma_crossover(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """MA crossover (placeholder)"""
    await show_under_development_message(update, context, "MA Crossover")

async def ma5_cross(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """MA5 cross (placeholder)"""
    await show_under_development_message(update, context, "MA5 Cross")

async def check_issi_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check ISSI data (placeholder)"""
    await show_under_development_message(update, context, "Check ISSI Data")

async def price_graph(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Price graph (placeholder)"""
    await show_under_development_message(update, context, "Price Graph")

async def tp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """TP (placeholder)"""
    await show_under_development_message(update, context, "TP")

async def vp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """VP (placeholder)"""
    await show_under_development_message(update, context, "VP")

async def rp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """RP (placeholder)"""
    await show_under_development_message(update, context, "RP")

async def sa(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """SA (placeholder)"""
    await show_under_development_message(update, context, "SA")

async def va(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """VA (placeholder)"""
    await show_under_development_message(update, context, "VA")

async def as_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """AS command (placeholder)"""
    await show_under_development_message(update, context, "AS Command")

async def pg2(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG2 (placeholder)"""
    await show_under_development_message(update, context, "PG2")

async def pg3(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG3 (placeholder)"""
    await show_under_development_message(update, context, "PG3")

async def pg4(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG4 (placeholder)"""
    await show_under_development_message(update, context, "PG4")

async def pg5(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG5 (placeholder)"""
    await show_under_development_message(update, context, "PG5")

async def pg6(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG6 (placeholder)"""
    await show_under_development_message(update, context, "PG6")

async def pg7(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG7 (placeholder)"""
    await show_under_development_message(update, context, "PG7")

async def pg8(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG8 (placeholder)"""
    await show_under_development_message(update, context, "PG8")

async def pg9(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG9 (placeholder)"""
    await show_under_development_message(update, context, "PG9")

async def pg10(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG10 (placeholder)"""
    await show_under_development_message(update, context, "PG10")

async def pg11(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PG11 (placeholder)"""
    await show_under_development_message(update, context, "PG11")

async def pgv(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """PGV (placeholder)"""
    await show_under_development_message(update, context, "PGV")

async def crypto_indodax(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Crypto Indodax (placeholder)"""
    await show_under_development_message(update, context, "Crypto Indodax")

async def significant_volume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Significant volume (placeholder)"""
    await show_under_development_message(update, context, "Significant Volume")

async def volume_compare(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Volume compare (placeholder)"""
    await show_under_development_message(update, context, "Volume Compare")

async def volume_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Volume history (placeholder)"""
    await show_under_development_message(update, context, "Volume History")

async def significant_volume_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Significant volume all (placeholder)"""
    await show_under_development_message(update, context, "Significant Volume All")

async def significant_volume_increase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Significant volume increase (placeholder)"""
    await show_under_development_message(update, context, "Significant Volume Increase")

async def top_gainers_consecutive_movers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers consecutive movers (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers Consecutive Movers")

async def top_gainers_consecutive_movers_volume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers consecutive movers volume (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers Consecutive Movers Volume")

async def top_losers_consecutive_movers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers consecutive movers (placeholder)"""
    await show_under_development_message(update, context, "Top Losers Consecutive Movers")

async def top_gainers_filtered(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers filtered (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers Filtered")

async def top_losers_filtered(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top losers filtered (placeholder)"""
    await show_under_development_message(update, context, "Top Losers Filtered")

async def bottom_bollinger_bands(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bottom Bollinger bands (placeholder)"""
    await show_under_development_message(update, context, "Bottom Bollinger Bands")

async def bbl_filter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """BBL filter (placeholder)"""
    await show_under_development_message(update, context, "BBL Filter")

async def bbh1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """BBH1 (placeholder)"""
    await show_under_development_message(update, context, "BBH1")

async def bbh2(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """BBH2 (placeholder)"""
    await show_under_development_message(update, context, "BBH2")

async def bottom_bollinger_ma5_crossover(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bottom Bollinger MA5 crossover (placeholder)"""
    await show_under_development_message(update, context, "Bottom Bollinger MA5 Crossover")

async def ff_filter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """FF filter (placeholder)"""
    await show_under_development_message(update, context, "FF Filter")

async def sim(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sim (placeholder)"""
    await show_under_development_message(update, context, "Sim")

async def buy_simulation_db(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy simulation DB (placeholder)"""
    await show_under_development_message(update, context, "Buy Simulation DB")

async def buy_single_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy single stock (placeholder)"""
    await show_under_development_message(update, context, "Buy Single Stock")

async def buy_market(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy market (placeholder)"""
    await show_under_development_message(update, context, "Buy Market")

async def sell_market(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sell market (placeholder)"""
    await show_under_development_message(update, context, "Sell Market")

async def buy_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy stock (placeholder)"""
    await show_under_development_message(update, context, "Buy Stock")

async def report_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Report status (placeholder)"""
    await show_under_development_message(update, context, "Report Status")

async def sell_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sell stock (placeholder)"""
    await show_under_development_message(update, context, "Sell Stock")

async def analyze_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report")

async def analyze_report_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report date (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report Date")

async def buy_stock1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy stock1 (placeholder)"""
    await show_under_development_message(update, context, "Buy Stock1")

async def beli_semua(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Beli semua (placeholder)"""
    await show_under_development_message(update, context, "Beli Semua")

async def report_status1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Report status1 (placeholder)"""
    await show_under_development_message(update, context, "Report Status1")

async def sell_stock1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sell stock1 (placeholder)"""
    await show_under_development_message(update, context, "Sell Stock1")

async def analyze_report1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report1 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report1")

async def analyze_report3(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report3 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report3")

async def analyze_report4(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report4 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report4")

async def analyze_report5(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report5 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report5")

async def analyze_report6(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report6 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report6")

async def analyze_report7(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report7 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report7")

async def analyze_report2(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report2 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report2")

async def analyze_report_date1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report date1 (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report Date1")

async def analyze_report_image(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report image (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report Image")

async def select_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Select account (placeholder)"""
    await show_under_development_message(update, context, "Select Account")

async def check_balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check balance (placeholder)"""
    await show_under_development_message(update, context, "Check Balance")

async def buy_index(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buy index (placeholder)"""
    await show_under_development_message(update, context, "Buy Index")

async def analyze_report_index(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Analyze report index (placeholder)"""
    await show_under_development_message(update, context, "Analyze Report Index")

async def sell_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Sell all (placeholder)"""
    await show_under_development_message(update, context, "Sell All")

async def top_gainers_by_volume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top gainers by volume (placeholder)"""
    await show_under_development_message(update, context, "Top Gainers by Volume")

async def high_volume_breakout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """High volume breakout (placeholder)"""
    await show_under_development_message(update, context, "High Volume Breakout")

async def high_volume_breakout_by_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """High volume breakout by date (placeholder)"""
    await show_under_development_message(update, context, "High Volume Breakout by Date")

async def reset_accounts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reset accounts (placeholder)"""
    await show_under_development_message(update, context, "Reset Accounts")

async def extract_pdf_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Extract PDF data (placeholder)"""
    await show_under_development_message(update, context, "Extract PDF Data")

async def update_daily_achievement(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Update daily achievement (placeholder)"""
    await show_under_development_message(update, context, "Update Daily Achievement")

async def view_achievement(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View achievement (placeholder)"""
    await show_under_development_message(update, context, "View Achievement")

async def get_achievement_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get achievement data (placeholder)"""
    await show_under_development_message(update, context, "Get Achievement Data")

async def process_latest_pdf(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process latest PDF (placeholder)"""
    await show_under_development_message(update, context, "Process Latest PDF")

# Export all functions
__all__ = [
    'create_application', 'setup_handlers', 'setup_command_handlers',
    'setup_crypto_exploration_handler', 'setup_feedback_handler',
    'setup_subscription_handler', 'start_command', 'help_command',
    'handle_callback_query', 'handle_text_input', 'handle_main_menu_input',
    'handle_submenu_input', 'handle_saham_menu_input', 'handle_crypto_menu_input',
    'handle_global_market_menu_input', 'handle_lainnya_menu_input',
    'handle_pending_action', 'handle_explore_input', 'error_handler'
]