import mongoose from "mongoose";
import {
  getMongoUri,
  log,
  logError,
  logWarn,
  maskMongoUri,
} from "../utils/logger.js";

const READY_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const logReadyState = (context = "") => {
  const readyState = mongoose.connection.readyState;
  const label = READY_STATE[readyState] ?? "unknown";
  const prefix = context ? `${context}: ` : "";
  log(`${prefix}readyState=${readyState} (${label})`);
};

let listenersRegistered = false;

const registerConnectionListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;
  mongoose.connection.on("connected", () => {
    log("mongoose.connection event: connected");
    logReadyState("connected event");
  });

  mongoose.connection.on("disconnected", () => {
    logWarn("mongoose.connection event: disconnected");
    logReadyState("disconnected event");
  });

  mongoose.connection.on("error", (err) => {
    logError("mongoose.connection event: error", err);
    logReadyState("error event");
  });

  mongoose.connection.on("reconnected", () => {
    log("mongoose.connection event: reconnected");
    logReadyState("reconnected event");
  });
};

export const getDbStatus = async () => {
  logReadyState("getDbStatus");

  const readyState = mongoose.connection.readyState;
  const status = {
    state: READY_STATE[readyState] ?? "unknown",
    readyState,
    connected: readyState === 1,
  };

  if (readyState !== 1 || !mongoose.connection.db) {
    return status;
  }

  status.host = mongoose.connection.host;
  status.name = mongoose.connection.name;
  status.port = mongoose.connection.port;

  try {
    log("getDbStatus: running admin ping...");
    await mongoose.connection.db.admin().ping();
    status.ping = "ok";
    log("getDbStatus: admin ping succeeded");
  } catch (err) {
    status.ping = "failed";
    status.pingError = err.message;
    logError("getDbStatus: admin ping failed", err);
  }

  return status;
};

const connectDB = async () => {
  log("connectDB() called");
  logReadyState("connectDB entry");

  const mongoUri = getMongoUri();

  if (!mongoUri) {
    logError(
      "MongoDB connection aborted: MONGO_URI and MONGODB_URI are both missing",
    );
    process.exit(1);
  }

  log(`Attempting MongoDB connection to ${maskMongoUri(mongoUri)}`);
  logReadyState("before mongoose.connect");

  registerConnectionListeners();

  try {
    await mongoose.connect(mongoUri);

    log("MongoDB connected successfully");
    logReadyState("after mongoose.connect");

    const users = mongoose.connection.collection("users");
    const emailCleanup = await users.updateMany(
      { email: null },
      { $unset: { email: 1 } },
    );
    const userIdCleanup = await users.updateMany(
      { userId: null },
      { $unset: { userId: 1 } },
    );

    if (emailCleanup.modifiedCount || userIdCleanup.modifiedCount) {
      log(
        `Cleaned nullable unique fields: email=${emailCleanup.modifiedCount}, userId=${userIdCleanup.modifiedCount}`,
      );
    }
  } catch (err) {
    logError("MongoDB connection failed", err);
    logReadyState("connectDB catch");

    if (err.message?.includes("bad auth")) {
      logError(
        "MongoDB auth failed — verify Atlas username/password and URL-encode special characters in the URI",
      );
    } else if (err.message?.includes("ENOTFOUND")) {
      logError(
        "MongoDB hostname not found — check the cluster hostname and password encoding in the URI",
      );
    } else if (err.message?.includes("IP")) {
      logError(
        "MongoDB network access blocked — add Vercel IPs or 0.0.0.0/0 in Atlas Network Access",
      );
    }

    process.exit(1);
  }
};

export default connectDB;
