const NOTIFICATION_ICON_PATH = "/assets/applogo2.png";

export const getNotificationIconUrl = () => {
  if (process.env.NOTIFICATION_ICON_URL) {
    return process.env.NOTIFICATION_ICON_URL;
  }

  const baseUrl =
    process.env.API_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `http://localhost:${process.env.PORT || 5001}`;

  return `${baseUrl.replace(/\/$/, "")}${NOTIFICATION_ICON_PATH}`;
};
