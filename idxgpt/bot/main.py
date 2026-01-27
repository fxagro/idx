"""
Main entry point for BJB Sekuritas Telegram Bot
Ties together all modules and starts the bot
"""

import asyncio
import logging
import sys
from datetime import datetime

# Import all modules
from config import *
from enums import *
from db_utils import *
from utils import *
from menus import *
from features_simple import *
from handlers import *

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("bot.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

async def main():
    """Main function to run the bot"""
    try:
        logger.info("Starting BJB Sekuritas Telegram Bot...")

        # Initialize databases
        await init_databases()
        logger.info("Databases initialized")

        # Create application
        app = create_application()
        logger.info("Application created")

        # Start the bot
        logger.info("Bot is running...")
        await app.run_polling()

    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Error running bot: {str(e)}")
        raise
    finally:
        # Cleanup
        await close_all_connections()
        logger.info("Bot shutdown complete")

if __name__ == "__main__":
    # Run the bot
    asyncio.run(main())