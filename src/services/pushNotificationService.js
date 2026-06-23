import PushToken from "../models/PushToken.js";
import Notification from "../models/Notification.js";
import { getFirebaseAdmin } from "../config/firebase.js";
import { getNotificationIconUrl } from "../config/notificationAssets.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const chunk = (items, size) => {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

export const registerPushToken = async ({
  userId,
  token,
  provider = "fcm",
  platform,
  deviceId,
}) => {
  const normalizedToken = token.trim();

  await PushToken.findOneAndUpdate(
    { token: normalizedToken },
    {
      user: userId,
      token: normalizedToken,
      provider,
      platform,
      deviceId: deviceId || null,
      lastUsedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const removePushToken = async ({ userId, token }) => {
  if (!token) {
    await PushToken.deleteMany({ user: userId });
    return;
  }

  await PushToken.deleteOne({ user: userId, token: token.trim() });
};

const sendExpoMessages = async (messages) => {
  if (!messages.length) return;

  for (const batch of chunk(messages, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[push] Expo send failed:", text);
    }
  }
};

const sendFcmMessages = async (messages) => {
  const admin = getFirebaseAdmin();
  if (!admin || !messages.length) return;

  for (const message of messages) {
    try {
      await admin.messaging().send(message);
    } catch (error) {
      const code = error?.code || error?.errorInfo?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await PushToken.deleteOne({ token: message.token });
      } else {
        console.error("[push] FCM send failed:", error.message);
      }
    }
  }
};

const buildPayload = ({ title, body, data = {} }) => {
  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? "")]),
  );

  return { title, body, data: stringData };
};

export const createInAppNotification = async (userId, payload) => {
  return Notification.create({
    user: userId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data: payload.data ?? {},
  });
};

export const notifyUser = async (userId, payload) => {
  if (!userId) return;

  try {
    await createInAppNotification(userId, payload);

    const tokens = await PushToken.find({ user: userId }).lean();
    if (!tokens.length) return;

    const { title, body, data } = buildPayload(payload);
    const iconUrl = getNotificationIconUrl();
    const expoMessages = [];
    const fcmMessages = [];

    for (const entry of tokens) {
      if (entry.provider === "expo") {
        expoMessages.push({
          to: entry.token,
          title,
          body,
          data,
          icon: iconUrl,
          sound: "default",
          priority: "high",
          channelId: "default",
        });
        continue;
      }

      fcmMessages.push({
        token: entry.token,
        notification: { title, body, imageUrl: iconUrl },
        data,
        android: {
          priority: "high",
          notification: { channelId: "default", imageUrl: iconUrl },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              mutableContent: true,
            },
          },
          fcmOptions: {
            imageUrl: iconUrl,
          },
        },
      });
    }

    await Promise.all([
      sendExpoMessages(expoMessages),
      sendFcmMessages(fcmMessages),
    ]);
  } catch (error) {
    console.error("[push] notifyUser failed:", error.message);
  }
};

export const notifyUsers = async (userIds, payload) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(uniqueIds.map((userId) => notifyUser(userId, payload)));
};
