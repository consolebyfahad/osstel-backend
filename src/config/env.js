const required = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

export default validateEnv;
