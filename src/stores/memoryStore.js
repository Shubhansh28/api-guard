class MemoryStore {
  constructor(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('MemoryStore options must be an object');
    }
    if (options.cleanupInterval !== undefined
      && (!Number.isInteger(options.cleanupInterval) || options.cleanupInterval < 1)) {
      throw new TypeError('MemoryStore cleanupInterval must be a positive integer');
    }
    if (options.maxCleanupKeys !== undefined
      && (!Number.isInteger(options.maxCleanupKeys) || options.maxCleanupKeys < 1)) {
      throw new TypeError('MemoryStore maxCleanupKeys must be a positive integer');
    }
    this.entries = new Map();
    this.cleanupInterval = options.cleanupInterval || 100;
    this.maxCleanupKeys = options.maxCleanupKeys || 1000;
    this.operations = 0;
    this.cleanupIterator = null;
  }

  /**
   * Atomically increment a fixed-window counter.
   * @param {string} key
   * @param {number} windowMs
   * @returns {{totalHits: number, resetTime: Date}}
   */
  increment(key, windowMs) {
    const now = Date.now();
    this.operations += 1;
    if (this.operations >= this.cleanupInterval) {
      this.operations = 0;
      this.cleanup(now, this.maxCleanupKeys);
    }
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const entry = { totalHits: 1, resetAt: now + windowMs };
      this.entries.set(key, entry);
      return { totalHits: entry.totalHits, resetTime: new Date(entry.resetAt) };
    }
    current.totalHits += 1;
    return { totalHits: current.totalHits, resetTime: new Date(current.resetAt) };
  }

  resetKey(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.cleanupIterator = null;
  }

  cleanup(now = Date.now(), maxEntries = this.maxCleanupKeys) {
    if (!this.cleanupIterator) this.cleanupIterator = this.entries.keys();
    let inspected = 0;
    while (inspected < maxEntries) {
      const next = this.cleanupIterator.next();
      if (next.done) {
        this.cleanupIterator = null;
        break;
      }
      const key = next.value;
      const entry = this.entries.get(key);
      inspected += 1;
      if (entry && entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

module.exports = { MemoryStore };
