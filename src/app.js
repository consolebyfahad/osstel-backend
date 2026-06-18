import express from "express";
import cors from "cors";
import helmet from "helmet";

import indexRoutes from "./routes/indexRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { getDbStatus } from "./config/db.js";
import { error, success } from "./utils/apiResponse.js";
import { log, logError } from "./utils/logger.js";

const app = express();

app.use((req, _res, next) => {
  log(`${req.method} ${req.path}`);
  next();
});

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:8081", "http://localhost:8082"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(apiLimiter);

app.get("/health", (_req, res) =>
  success(res, "Server is healthy", { status: "ok" }),
);

app.get("/health/db", async (_req, res) => {
  log("GET /health/db — checking database connection");

  try {
    const dbStatus = await getDbStatus();
    log(
      `GET /health/db — result connected=${dbStatus.connected} ping=${dbStatus.ping ?? "n/a"} readyState=${dbStatus.readyState}`,
    );

    if (dbStatus.connected && dbStatus.ping !== "failed") {
      return success(res, "MongoDB is connected", dbStatus);
    }

    return error(res, "MongoDB is not connected", dbStatus, 503);
  } catch (err) {
    logError("GET /health/db — unexpected error", err);
    return error(res, "Database health check failed", { message: err.message }, 500);
  }
});

app.use("/api/v1", indexRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
