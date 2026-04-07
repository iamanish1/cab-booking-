const Redis = require("ioredis");
const { env } = require("./env");

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key) {
    this.store.delete(key);
  }
}

function createCacheClient(logger) {
  if (!env.redisUrl) {
    logger.warn("REDIS_URL missing, using in-memory cache fallback");
    return new MemoryCache();
  }

  const client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: () => null, // disable automatic reconnect
  });

  client.on("error", () => {
    // suppress repeated logs; handled once in connect()
  });

  // Wraps the Redis client and falls back to MemoryCache if not connected
  const memory = new MemoryCache();
  let delegate = memory; // start with memory until Redis confirms connected

  return {
    async get(key) {
      return delegate.get(key);
    },
    async set(key, value, ttlSeconds) {
      return delegate.set(key, value, ttlSeconds);
    },
    async del(key) {
      return delegate.del(key);
    },
    async connect() {
      try {
        await client.connect();
        // Promote to Redis
        delegate = {
          async get(key) { return client.get(key); },
          async set(key, value, ttlSeconds) {
            if (ttlSeconds) return client.set(key, value, "EX", ttlSeconds);
            return client.set(key, value);
          },
          async del(key) { return client.del(key); },
        };
        logger.info("Redis connected");
      } catch (error) {
        logger.warn({ error: error.message }, "Redis unavailable, using in-memory cache fallback");
        // delegate stays as MemoryCache
      }
    },
  };
}

module.exports = { createCacheClient };
