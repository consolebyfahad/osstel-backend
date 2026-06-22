import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "../..");

let initialized = false;

const findDefaultServiceAccountPath = () => {
  try {
    const match = readdirSync(backendRoot).find(
      (file) =>
        file.includes("firebase-adminsdk") && file.endsWith(".json"),
    );
    return match ? resolve(backendRoot, match) : null;
  } catch {
    return null;
  }
};

const initFirebase = () => {
  if (initialized) return admin;

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let serviceAccount;

  if (inlineJson) {
    serviceAccount = JSON.parse(inlineJson);
  } else {
    const filePath = configuredPath
      ? resolve(process.cwd(), configuredPath)
      : findDefaultServiceAccountPath();

    if (!filePath || !existsSync(filePath)) {
      console.warn(
        "[firebase] Service account not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH. FCM push disabled.",
      );
      return null;
    }

    serviceAccount = JSON.parse(readFileSync(filePath, "utf8"));
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  console.log(
    `[firebase] Admin SDK initialized for project ${serviceAccount.project_id}`,
  );
  return admin;
};

export const getFirebaseAdmin = () => {
  if (!initialized) {
    return initFirebase();
  }
  return admin;
};

export const isFirebaseConfigured = () => Boolean(getFirebaseAdmin());

export default initFirebase;
