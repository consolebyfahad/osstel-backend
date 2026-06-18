import mongoose from "mongoose";

const READY_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const getDbStatus = async () => {
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
    await mongoose.connection.db.admin().ping();
    status.ping = "ok";
  } catch (err) {
    status.ping = "failed";
    status.pingError = err.message;
  }

  return status;
};

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Add it to your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

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
      console.log(
        `Cleaned nullable unique fields: email=${emailCleanup.modifiedCount}, userId=${userIdCleanup.modifiedCount}`,
      );
    }

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    if (error.message.includes("bad auth")) {
      console.error(
        "\nFix: In MongoDB Atlas → Database Access, reset the password for user 'rehmanfahad', then update MONGO_URI in .env.\n" +
          "URL-encode special characters in the password (@ → %40, < → %3C, > → %3E).\n",
      );
    } else if (error.message.includes("ENOTFOUND")) {
      console.error(
        "\nFix: Your MONGO_URI hostname looks wrong — usually caused by an unencoded @ in the password.\n" +
          "Encode @ as %40 in the password section of the URI.",
      );
    }

    process.exit(1);
  }
};

export default connectDB;
