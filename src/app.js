import express from "express";
import cors from "cors";
import helmet from "helmet";

import indexRoutes from "./routes/indexRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { success } from "./utils/apiResponse.js";

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

app.get("/", (_req, res) =>
  success(res, "API is running", {
    version: "v1",
  }),
);

app.get("/health", (_req, res) =>
  success(res, "Server is healthy", { status: "ok" }),
);

app.use("/api/v1", indexRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
