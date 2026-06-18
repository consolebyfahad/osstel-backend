import { getMongoUri, logError } from "../utils/logger.js";

const required = ["JWT_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);

  if (!getMongoUri()) {
    missing.push("MONGO_URI or MONGODB_URI");
  }

  if (missing.length) {
    logError(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

export default validateEnv;
