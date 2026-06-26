import mongoose from "mongoose";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import Payment from "../models/Payment.js";
import Complaint from "../models/Complaint.js";
import { getPlanConfig } from "../config/plans.js";

export const getHostelDashboardStats = async (hostelId) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const hostelObjectId = new mongoose.Types.ObjectId(hostelId);

  const [rooms, activeTenancies, paymentStats, complaintStats] =
    await Promise.all([
      Room.find({ hostel: hostelId }),
      Tenancy.find({ hostel: hostelId, status: "active" }),
      Payment.aggregate([
        {
          $match: {
            hostel: hostelObjectId,
            month,
            year,
          },
        },
        {
          $group: {
            _id: "$status",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Complaint.aggregate([
        { $match: { hostel: hostelObjectId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const totalRooms = rooms.length;
  const totalBedrooms = rooms.reduce((sum, room) => sum + room.capacity, 0);

  const occupiedRoomIds = new Set(
    activeTenancies.map((tenancy) => tenancy.room.toString())
  );
  const occupiedRooms = occupiedRoomIds.size;
  const vacantRooms = totalRooms - occupiedRooms;

  const occupiedBeds = activeTenancies.length;
  const vacantBeds = totalBedrooms - occupiedBeds;

  const paidStats = paymentStats.find((item) => item._id === "paid") || {
    totalAmount: 0,
    count: 0,
  };
  const reviewStats = paymentStats.find((item) => item._id === "review") || {
    totalAmount: 0,
    count: 0,
  };
  const pendingStats =
    paymentStats
      .filter((item) => ["pending", "rejected"].includes(item._id))
      .reduce(
        (acc, item) => ({
          totalAmount: acc.totalAmount + item.totalAmount,
          count: acc.count + item.count,
        }),
        { totalAmount: 0, count: 0 }
      );

  const monthlyCollection =
    paymentStats.reduce((sum, item) => sum + item.totalAmount, 0) || 0;
  const complaintsByStatus = complaintStats.reduce(
    (acc, item) => {
      acc[item._id] = item.count;
      return acc;
    },
    { open: 0, in_progress: 0, resolved: 0 }
  );

  const totalComplaints = Object.values(complaintsByStatus).reduce(
    (sum, count) => sum + count,
    0
  );
  const openComplaints =
    complaintsByStatus.open + complaintsByStatus.in_progress;

  return {
    rooms: {
      totalRooms,
      totalBedrooms,
      occupied: occupiedRooms,
      vacant: vacantRooms,
      occupiedBeds,
      vacantBeds,
    },
    monthlyCollection: {
      month,
      year,
      expected: monthlyCollection,
      collected: paidStats.totalAmount,
      pending: pendingStats.totalAmount,
      review: reviewStats.totalAmount,
    },
    pending: {
      amount: pendingStats.totalAmount,
      count: pendingStats.count,
    },
    complaints: {
      total: totalComplaints,
      open: openComplaints,
      resolved: complaintsByStatus.resolved,
      breakdown: complaintsByStatus,
    },
  };
};

const emptyComplaints = {
  total: 0,
  open: 0,
  resolved: 0,
  breakdown: { open: 0, in_progress: 0, resolved: 0 },
};

export const filterDashboardStatsForPlan = (stats, planId) => {
  const plan = getPlanConfig(planId);
  const filtered = { ...stats, rooms: { ...stats.rooms } };

  if (!plan.features.complaints) {
    filtered.complaints = emptyComplaints;
  }

  if (!plan.features.payment_proof) {
    filtered.monthlyCollection = {
      ...stats.monthlyCollection,
      review: 0,
    };
  }

  return filtered;
};
