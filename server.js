import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import validateEnv from "./src/config/env.js";
import initFirebase from "./src/config/firebase.js";
import { startRentSyncJob } from "./src/jobs/rentSyncJob.js";
import { log, logError, logMongoUriEnv } from "./src/utils/logger.js";

log("App starting...");
log(`NODE_ENV=${process.env.NODE_ENV ?? "(not set)"}`);
logMongoUriEnv();

process.on("uncaughtException", (err) => {
  logError("Uncaught exception", err);
});

process.on("unhandledRejection", (reason) => {
  logError(
    "Unhandled promise rejection",
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

validateEnv();
initFirebase();

const PORT = process.env.PORT || 5001;

await connectDB();

startRentSyncJob();

app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
