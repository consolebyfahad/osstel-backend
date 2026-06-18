import "dotenv/config";
import app from "../src/app.js";
import initFirebase from "../src/config/firebase.js";
import validateEnv from "../src/config/env.js";

try {
  validateEnv({ exitOnError: false });
  initFirebase();
} catch {
  // Env validation errors are returned by API handlers when DB/auth is accessed.
}

export default app;
