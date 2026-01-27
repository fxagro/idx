# BJB Sekuritas Telegram Bot - Refactored Version

This is a refactored version of the BJB Sekuritas Telegram Bot that has been modularized for better maintainability and stability.

## Architecture Overview

The bot has been refactored from a single large `bot.py` file (29,184 lines) into multiple focused modules:

### Module Structure

1. **`config.py`** - Configuration and constants
   - Bot token and API keys
   - Database paths and file paths
   - Stock lists (LQ45, KOMPAS100, JII70, MBX, ISSI)
   - Sectors mapping
   - Global constants and settings

2. **`enums.py`** - Enumeration types
   - Menu states for conversation flow
   - Subscription types
   - Error types
   - Access levels

3. **`db_utils.py`** - Async database operations
   - Database connection management
   - User access control
   - CRUD operations for stocks, users, watchlists
   - Async database utilities

4. **`utils.py`** - Utility functions and decorators
   - Error handling decorators
   - Access control decorators
   - Data formatting utilities
   - Validation functions
   - Performance monitoring

5. **`menus.py`** - Menu system and state management
   - Menu display functions
   - State transition logic
   - User interface management
   - Navigation helpers

6. **`features_simple.py`** - Core bot features
   - Stock analysis functions
   - Top gainers/losers
   - Crypto data
   - Global market data
   - Watchlist management

7. **`handlers.py`** - Event handlers
   - Command handlers
   - Callback query handlers
   - Message handlers
   - Conversation handlers

8. **`main.py`** - Application entry point
   - Bot initialization
   - Module coordination
   - Main execution loop

## Key Improvements

### 1. Modular Architecture
- **Before**: Single 29,184-line file
- **After**: 8 focused modules with clear responsibilities
- **Benefits**: Easier maintenance, testing, and debugging

### 2. Async Database Operations
- **Before**: Blocking sqlite3 operations
- **After**: Async aiosqlite operations
- **Benefits**: Better performance and responsiveness

### 3. State Machine Implementation
- **Before**: Ad-hoc state management
- **After**: Proper enum-based state machine
- **Benefits**: Consistent menu flow and better user experience

### 4. Error Handling and Logging
- **Before**: Basic error handling
- **After**: Comprehensive error handling with decorators
- **Benefits**: Better debugging and user feedback

### 5. Access Control System
- **Before**: Simple access checks
- **After**: Decorator-based access control with subscription tiers
- **Benefits**: Proper premium feature management

### 6. Code Organization
- **Before**: Mixed concerns in single file
- **After**: Separation of concerns across modules
- **Benefits**: Better code organization and maintainability

## Installation and Setup

### Prerequisites
- Python 3.8+
- Required packages (see requirements.txt)
- Telegram Bot Token
- Database files

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables or update config.py
4. Run the bot:
   ```bash
   python main.py
   ```

## Testing Instructions

### Menu Flow Testing
1. Start the bot with `/start`
2. Test main menu navigation:
   - Dashboard → Saham → Back to submenu
   - Dashboard → Crypto → Back to submenu
   - Dashboard → Global Market → Back to submenu
3. Test state persistence across menu transitions
4. Verify "back" buttons work correctly

### Premium Access Testing
1. Test free features (stock data, top gainers, crypto data)
2. Test premium features (should show premium required message)
3. Test access limit (3 free accesses per day)
4. Test subscription system

### Database Testing
1. Test user registration and access counting
2. Test watchlist functionality
3. Test data retrieval and caching

### Error Handling Testing
1. Test invalid ticker symbols
2. Test network failures
3. Test database connection issues
4. Test malformed input

## Sample Test Cases

### Menu Flow Test
```
1. /start → Main menu
2. Dashboard → Submenu
3. Saham → Saham menu
4. ⬅️ Kembali ke Submenu → Submenu
5. ⬅️ Kembali ke Menu Utama → Main menu
```

### Premium Access Test
```
1. /predict BBRI → Should show premium required
2. /at BBRI → Should show premium required
3. /c BBRI → Should work (free feature)
4. /tg → Should work (free feature)
```

### State Synchronization Test
```
1. Navigate to crypto menu
2. Use "Eksplorasi Crypto" feature
3. Test back navigation
4. Verify state is properly reset
```

## Configuration

### Environment Variables
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `CMC_API_KEY` - CoinMarketCap API key
- `NEWS_API_KEY` - News API key

### Database Configuration
- Main database: `stock_data.db`
- Crypto database: `cmc.db`
- User accounts: `akun_{user_id}.json`

## Features Status

### ✅ Implemented (Free)
- Stock data lookup (`/c`)
- Top gainers/losers (`/tg`, `/tl`)
- Crypto data (`/tc`)
- Global indices (`/ig`)
- Commodity prices (`/cp`)
- Watchlist management (`/watch`, `/unwatch`, `/listwatch`)

### 🔒 Premium Features
- Technical analysis (`/at`)
- Stock prediction (`/predict`)
- Fundamental analysis (`/af`)
- Trading signals (`/signal`)
- Volatility analysis (`/volatility`)
- Value investing (`/value`)

### 🚧 Under Development
- Advanced charting features
- Portfolio simulation
- Real-time notifications
- Admin management tools

## Performance Improvements

1. **Async Operations**: All database and network operations are now async
2. **Caching**: Implemented caching for frequently accessed data
3. **Error Recovery**: Better error handling and recovery mechanisms
4. **Memory Management**: Improved memory usage with proper cleanup
5. **Rate Limiting**: Built-in rate limiting for API calls

## Monitoring and Logging

- Comprehensive logging system
- Performance monitoring
- Error tracking and reporting
- Database operation logging
- User action tracking

## Security Improvements

- Input validation and sanitization
- SQL injection prevention
- File operation security
- API key management
- User access control

## Future Enhancements

1. **Complete Premium Features**: Implement all premium analysis tools
2. **Real-time Data**: Add WebSocket support for real-time updates
3. **Advanced AI**: Integrate machine learning models for better predictions
4. **Multi-language Support**: Add internationalization
5. **Admin Dashboard**: Web interface for bot management
6. **API Integration**: REST API for external integrations

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check database file permissions
   - Verify database schema
   - Check available disk space

2. **API Rate Limits**
   - Implement exponential backoff
   - Add request caching
   - Monitor API usage

3. **Memory Issues**
   - Monitor memory usage
   - Implement cleanup routines
   - Use pagination for large datasets

4. **State Management Issues**
   - Check state transitions
   - Verify state persistence
   - Monitor user sessions

### Debug Mode

Enable debug logging by setting log level to DEBUG in config.py:
```python
LOG_CONFIG = {
    'level': 'DEBUG',
    # ... other settings
}
```

## Contributing

1. Follow the modular architecture
2. Add proper error handling
3. Include logging for new features
4. Write tests for new functionality
5. Update documentation

## License

This project is part of BJB Sekuritas internal tools and is not publicly licensed.