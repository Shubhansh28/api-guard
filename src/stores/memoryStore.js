class MemoryStore {
  constructor() {
    this.entries = new Map();
  }

  /**
   * Atomically increment a fixed-window counter.
   * @param {string} key
   * @param {number} windowMs
   * @returns {{totalHits: number, resetTime: Date}}
   */
  increment(key, windowMs) {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const entry = { totalHits: 1, resetAt: now + windowMs };
      this.entries.set(key, entry);
      this.cleanup(now);
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
  }

  cleanup(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

module.exports = { MemoryStore };
