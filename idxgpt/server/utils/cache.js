class InMemoryCache {
  constructor() {
    this.cache = {};
  }

  get(key) {
    return this.cache[key];
  }

  set(key, value, ttl = 300) { // Default 5 minutes TTL
    this.cache[key] = value;
    if (ttl > 0) {
      setTimeout(() => {
        delete this.cache[key];
      }, ttl * 1000);
    }
  }

  // Enhanced methods for quota management
  getQuota(key) {
    const value = this.cache[key];
    return value ? parseInt(value) : null;
  }

  setQuota(key, value, ttl = 3600) { // Default 1 hour TTL for quota
    this.set(key, value.toString(), ttl);
  }

  incrementQuota(key, ttl = 3600) {
    const currentValue = this.getQuota(key) || 0;
    this.setQuota(key, currentValue + 1, ttl);
    return currentValue + 1;
  }

  delete(key) {
    delete this.cache[key];
  }

  clear() {
    this.cache = {};
  }

  size() {
    return Object.keys(this.cache).length;
  }
}

module.exports = new InMemoryCache();