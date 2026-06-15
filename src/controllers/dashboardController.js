import Hostel from "../models/Hostel.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getHostelDashboardStats } from "../utils/hostelStats.js";
import { getRecentActivities } from "../utils/activityFeed.js";
import AppError from "../utils/AppError.js";
import { requireManagerHostel } from "../utils/hostelHelpers.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const { hostelId } = req.query;
  const hostels = await Hostel.find({ manager: req.user._id }).lean();

  if (!hostels.length) {
    throw new AppError("No hostels found for this manager", 404);
  }

  if (hostelId) {
    const hostel = hostels.find((item) => item._id.toString() === hostelId);

    if (!hostel) {
      throw new AppError("Hostel not found", 404);
    }

    const stats = await getHostelDashboardStats(hostel._id);

    return success(res, "Dashboard fetched successfully", {
      hostel: { id: hostel._id, name: hostel.name },
      ...stats,
    });
  }

  const hostelsWithStats = await Promise.all(
    hostels.map(async (hostel) => {
      const stats = await getHostelDashboardStats(hostel._id);
      return {
        hostel: { id: hostel._id, name: hostel.name },
        ...stats,
      };
    })
  );

  return success(res, "Dashboard fetched successfully", {
    hostels: hostelsWithStats,
  });
});

export const getRecentActivitiesFeed = asyncHandler(async (req, res) => {
  const { hostelId, limit = 20 } = req.query;

  if (!hostelId) {
    throw new AppError("hostelId is required", 400);
  }

  const hostel = await requireManagerHostel(hostelId, req.user._id);
  const activityLimit = Math.min(Number(limit) || 20, 50);
  const activities = await getRecentActivities(hostel._id, activityLimit);

  return success(res, "Recent activities fetched successfully", {
    hostel: { id: hostel._id, name: hostel.name },
    activities,
  });
});
