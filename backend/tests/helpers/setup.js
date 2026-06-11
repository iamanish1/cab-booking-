const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const pino = require("pino");
const { createApp } = require("../../src/app");
const { setSocketServer } = require("../../src/services/socket.service");

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60_000 },
  });
  const uri = mongod.getUri();
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

async function stopDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

function makeMemoryCache() {
  const store = new Map();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
    },
    async del(key) {
      store.delete(key);
    },
  };
}

function buildTestServer() {
  const logger = pino({ level: "silent" });
  const cache = makeMemoryCache();
  const { app } = createApp({ cache, logger });
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  setSocketServer(io);
  return { app, server, io, cache };
}

module.exports = { startDb, stopDb, clearDb, buildTestServer };
