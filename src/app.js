import express from "express";
import cors from "cors";
import helmet from "helmet";

import indexRoutes from "./routes/indexRoutes.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/v1", indexRoutes);

export default app;
