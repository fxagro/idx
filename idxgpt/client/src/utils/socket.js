import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
  }

  connect(serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000') {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
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
      console.warn('Socket not connected');
      return;
    }

    const key = `${symbol}_${market}`;
    
    // Store callback for this subscription
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Subscribe to price updates
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
      console.warn('Socket not connected');
      return;
    }

    this.socket.on('market_summary', callback);
    this.socket.emit('get_market_summary');
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