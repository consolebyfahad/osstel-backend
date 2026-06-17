import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));

let initialized = false;

const initFirebase = () => {
  if (initialized) return admin;

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const defaultPath = resolve(
    __dirname,
    "../../osstel-fa11ad-firebase-adminsdk-fbsvc-4d976b8297.json",
  );

  let serviceAccount;

  if (inlineJson) {
    serviceAccount = JSON.parse(inlineJson);
  } else {
    const filePath = configuredPath
      ? resolve(process.cwd(), configuredPath)
      : defaultPath;

    if (!existsSync(filePath)) {
      console.warn(
        `[firebase] Service account not found at ${filePath}. FCM push disabled.`,
      );
      return null;
    }

    serviceAccount = JSON.parse(readFileSync(filePath, "utf8"));
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
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
