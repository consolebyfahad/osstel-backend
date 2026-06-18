import express from "express";
import cors from "cors";
import helmet from "helmet";

import indexRoutes from "./routes/indexRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { getDbStatus } from "./config/db.js";
import { error, success } from "./utils/apiResponse.js";

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

app.get("/health/db", async (_req, res) => {
  const dbStatus = await getDbStatus();

  if (dbStatus.connected && dbStatus.ping !== "failed") {
    return success(res, "MongoDB is connected", dbStatus);
  }

  return error(res, "MongoDB is not connected", dbStatus, 503);
});

app.use("/api/v1", indexRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
