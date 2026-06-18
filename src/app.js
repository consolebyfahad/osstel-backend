import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import indexRoutes from "./routes/indexRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { ensureDbConnected, getDbStatus } from "./config/db.js";
import { error, success } from "./utils/apiResponse.js";
import asyncHandler from "./middleware/asyncHandler.js";

const app = express();

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

app.get(
  "/health/db",
  asyncHandler(async (_req, res) => {
    try {
      await ensureDbConnected();
      const dbStatus = await getDbStatus();

      if (dbStatus.connected && dbStatus.ping !== "failed") {
        return success(res, "MongoDB is connected", dbStatus);
      }

      return error(res, "MongoDB is not connected", dbStatus, 503);
    } catch (err) {
      return error(
        res,
        "MongoDB connection failed",
        {
          message: err.message,
          readyState: mongoose.connection.readyState,
          runtime: process.env.VERCEL === "1" ? "vercel-serverless" : "node-server",
        },
        503,
      );
    }
  }),
);

app.use(
  "/api/v1",
  asyncHandler(async (_req, _res, next) => {
    await ensureDbConnected();
    next();
  }),
  indexRoutes,
);

app.use(notFound);
app.use(errorHandler);

export default app;
