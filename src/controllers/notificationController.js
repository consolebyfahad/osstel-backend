import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import {
  registerPushToken,
  removePushToken,
} from "../services/pushNotificationService.js";

const formatNotification = (item) => ({
  id: item._id,
  title: item.title,
  body: item.body,
  type: item.type,
  data: item.data ?? {},
  readAt: item.readAt,
  createdAt: item.createdAt,
});

export const registerMyPushToken = asyncHandler(async (req, res) => {
  const { token, provider = "fcm", platform, deviceId } = req.body;

  if (!token?.trim()) {
    throw new AppError("token is required", 400);
  }

  if (!platform) {
    throw new AppError("platform is required", 400);
  }

  await registerPushToken({
    userId: req.user._id,
    token,
    provider,
    platform,
    deviceId,
  });

  return success(res, "Push token registered");
});

export const removeMyPushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  await removePushToken({ userId: req.user._id, token });
  return success(res, "Push token removed");
});

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);

  return success(res, "Notifications fetched successfully", {
    notifications: items.map(formatNotification),
    unreadCount,
    pagination: buildPagination(total, page, limit),
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  notification.readAt = new Date();
  await notification.save();

  return success(res, "Notification marked as read", {
    notification: formatNotification(notification),
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );

  return success(res, "All notifications marked as read");
});

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    readAt: null,
  });

  return success(res, "Unread count fetched", { unreadCount });
});
