import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
  }

  connect(serverUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin) {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Determine the correct URL based on current environment
    let url = serverUrl;
    
    // If we're in production and no explicit URL is set, use the current origin
    if (!import.meta.env.VITE_SOCKET_URL && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      url = window.location.origin;
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.warn('🔌 WebSocket connection error (non-critical):', error.message);
      // Don't throw error - allow app to continue without WebSocket
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribers.clear();
    }
  }

  subscribeToStock(symbol, market = 'idx', callback) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, skipping subscription');
      return;
    }

    const key = `${symbol}_${market}`;
    
    // Store callback for this subscription
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Subscribe to price updates
    try {
      this.socket.emit('subscribe_stock', { symbol, market });
      
      // Listen for price updates
      this.socket.on('price_update', (data) => {
        if (data.symbol === symbol) {
          const callbacks = this.subscribers.get(key);
          if (callbacks) {
            callbacks.forEach(cb => cb(data));
          }
        }
      });

      console.log(`📊 Subscribed to ${symbol} (${market})`);
    } catch (error) {
      console.warn('Failed to subscribe to stock:', error.message);
    }
  }

  unsubscribeFromStock(symbol, market = 'idx', callback = null) {
    if (!this.socket?.connected) {
      return;
    }

    const key = `${symbol}_${market}`;
    
    if (callback && this.subscribers.has(key)) {
      this.subscribers.get(key).delete(callback);
      
      // If no more callbacks, unsubscribe completely
      if (this.subscribers.get(key).size === 0) {
        this.subscribers.delete(key);
        this.socket.emit('unsubscribe_stock', { symbol, market });
        console.log(`📊 Unsubscribed from ${symbol} (${market})`);
      }
    } else {
      // Remove all callbacks
      this.subscribers.delete(key);
      this.socket.emit('unsubscribe_stock', { symbol, market });
      console.log(`📊 Unsubscribed from ${symbol} (${market})`);
    }
  }

  onMarketSummary(callback) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, skipping market summary subscription');
      return;
    }

    try {
      this.socket.on('market_summary', callback);
      this.socket.emit('get_market_summary');
    } catch (error) {
      console.warn('Failed to subscribe to market summary:', error.message);
    }
  }

  offMarketSummary(callback) {
    if (this.socket) {
      this.socket.off('market_summary', callback);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;