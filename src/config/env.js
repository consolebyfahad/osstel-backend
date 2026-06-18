export const getMongoUri = () =>
  process.env.MONGO_URI || process.env.MONGODB_URI || "";

const required = ["JWT_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = ({ exitOnError = true } = {}) => {
  const missing = required.filter((key) => !process.env[key]);

  if (!getMongoUri()) {
    missing.push("MONGO_URI or MONGODB_URI");
  }

  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;

    if (exitOnError) {
      console.error(message);
      process.exit(1);
    }

    throw new Error(message);
  }
};

export default validateEnv;
