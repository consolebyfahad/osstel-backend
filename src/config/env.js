export const getMongoUri = () =>
  process.env.MONGO_URI || process.env.MONGODB_URI || "";

const required = ["JWT_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = ({ exitOnError = true } = {}) => {
  const missing = required.filter((key) => !process.env[key]);

  if (!getMongoUri()) {
    missing.push("MONGO_URI or MONGODB_URI");
  }

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    missing.push("CRON_SECRET");
  }

  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;

    if (exitOnError) {
      console.error(message);
      process.exit(1);
    }

    throw new Error(message);
  }

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.MANAGER_REGISTRATION_SECRET
  ) {
    console.warn(
      "WARNING: MANAGER_REGISTRATION_SECRET is not set — anyone can register as a manager.",
    );
  }
};

export default validateEnv;
