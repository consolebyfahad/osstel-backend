const NOTIFICATION_IMAGE_PATH = "/assets/applogo.png";
const NOTIFICATION_STATUS_BAR_ICON_PATH = "/assets/notification-icon.png";
const ANDROID_NOTIFICATION_ICON = "notification_icon";
const ANDROID_NOTIFICATION_COLOR = "#3B82F6";

const getAssetBaseUrl = () =>
  process.env.API_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  `http://localhost:${process.env.PORT || 5001}`;

const buildAssetUrl = (path, overrideEnvVar) => {
  if (process.env[overrideEnvVar]) {
    return process.env[overrideEnvVar];
  }

  return `${getAssetBaseUrl().replace(/\/$/, "")}${path}`;
};

export const getNotificationImageUrl = () =>
  buildAssetUrl(NOTIFICATION_IMAGE_PATH, "NOTIFICATION_IMAGE_URL");

export const getNotificationStatusBarIconUrl = () =>
  buildAssetUrl(
    NOTIFICATION_STATUS_BAR_ICON_PATH,
    "NOTIFICATION_STATUS_BAR_ICON_URL",
  );

export const getAndroidNotificationIcon = () => ANDROID_NOTIFICATION_ICON;

export const getAndroidNotificationColor = () => ANDROID_NOTIFICATION_COLOR;
