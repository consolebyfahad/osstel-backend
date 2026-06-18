import mongoose from "mongoose";
import { getMongoUri } from "./env.js";

const READY_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const isVercel = () => process.env.VERCEL === "1";

const getCache = () => {
  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null, cleanupDone: false };
  }
  return global.mongoose;
};

const runStartupCleanup = async () => {
  const cache = getCache();
  if (cache.cleanupDone) return;
  cache.cleanupDone = true;

  const users = mongoose.connection.collection("users");
  await users.updateMany({ email: null }, { $unset: { email: 1 } });
  await users.updateMany({ userId: null }, { $unset: { userId: 1 } });
};

const handleConnectionError = (err) => {
  if (!isVercel()) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  throw err;
};

export const ensureDbConnected = async () => {
  const cache = getCache();
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    throw new Error("MONGO_URI and MONGODB_URI are both missing");
  }

  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      })
      .then(async (connection) => {
        await runStartupCleanup();
        return connection;
      })
      .catch((err) => {
        cache.promise = null;
        return handleConnectionError(err);
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
};

export const getDbStatus = async () => {
  const readyState = mongoose.connection.readyState;
  const status = {
    state: READY_STATE[readyState] ?? "unknown",
    readyState,
    connected: readyState === 1,
    runtime: isVercel() ? "vercel-serverless" : "node-server",
  };

  if (readyState !== 1 || !mongoose.connection.db) {
    return status;
  }

  status.host = mongoose.connection.host;
  status.name = mongoose.connection.name;
  status.port = mongoose.connection.port;

  try {
    await mongoose.connection.db.admin().ping();
    status.ping = "ok";
  } catch (err) {
    status.ping = "failed";
    status.pingError = err.message;
  }

  return status;
};

const connectDB = async () => {
  await ensureDbConnected();
};

export default connectDB;
