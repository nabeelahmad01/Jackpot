const cacheStore = new Map();

export const cache = {
  get(key) {
    const cached = cacheStore.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      cacheStore.delete(key);
      return null;
    }
    return cached.value;
  },
  
  set(key, value, ttlSeconds = 60) {
    cacheStore.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  },
  
  del(key) {
    if (typeof key === 'string') {
      const lowerKey = key.toLowerCase();
      for (const k of cacheStore.keys()) {
        if (typeof k === 'string') {
          const lowerK = k.toLowerCase();
          if (
            lowerK === lowerKey || 
            lowerK.startsWith(lowerKey + '_') || 
            lowerK.startsWith(lowerKey.replace('_all', '') + '_')
          ) {
            cacheStore.delete(k);
          }
        }
      }
    } else {
      cacheStore.delete(key);
    }
  },
  
  clear() {
    cacheStore.clear();
  }
};
