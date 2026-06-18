const timestamp = () => new Date().toISOString();

const format = (level, message) => `[${timestamp()}] ${level} ${message}`;

export const log = (message) => {
  console.log(format("INFO", message));
};

export const logError = (message, err) => {
  console.error(format("ERROR", message));
  if (err?.stack) {
    console.error(err.stack);
  } else if (err) {
    console.error(err);
  }
};

export const logWarn = (message) => {
  console.warn(format("WARN", message));
};

export const getMongoUri = () =>
  process.env.MONGO_URI || process.env.MONGODB_URI || "";

export const maskMongoUri = (uri) => {
  if (!uri) return "(not set)";

  try {
    const masked = uri.replace(
      /^(mongodb(?:\+srv)?:\/\/)([^@/]+@)?/i,
      (_, scheme) => `${scheme}***@`,
    );
    const withoutQuery = masked.split("?")[0];
    return withoutQuery.length > 120
      ? `${withoutQuery.slice(0, 120)}...`
      : withoutQuery;
  } catch {
    return "(unable to mask uri)";
  }
};

export const logMongoUriEnv = () => {
  const mongoUri = process.env.MONGO_URI;
  const mongodbUri = process.env.MONGODB_URI;
  const resolved = getMongoUri();

  log(`MONGO_URI exists=${Boolean(mongoUri)}`);
  log(`MONGODB_URI exists=${Boolean(mongodbUri)}`);

  if (resolved) {
    log(`Mongo URI (masked)=${maskMongoUri(resolved)}`);
  } else {
    logWarn("No Mongo URI found in MONGO_URI or MONGODB_URI");
  }
};
