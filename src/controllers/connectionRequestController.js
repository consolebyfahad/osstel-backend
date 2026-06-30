import JoinRequest from "../models/JoinRequest.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Expense from "../models/Expense.js";
import Hostel from "../models/Hostel.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  findUnlinkedTenancyForUserInHostel,
  linkResidentToTenancy,
} from "../utils/residentHelpers.js";
import { getManagerHostel } from "../utils/hostelHelpers.js";
import { seedRentForNewTenancy } from "../utils/rentHelpers.js";
import { notifyUser } from "../services/pushNotificationService.js";
import { syncRoomStatus } from "../utils/residentHelpers.js";

const formatJoinRequest = (request) => ({
  id: String(request._id),
  status: request.status,
  createdAt: request.createdAt,
  approvedAt: request.approvedAt,
  rejectedAt: request.rejectedAt,
  resident: request.resident
    ? {
        id: String(request.resident._id),
        name: request.resident.name,
        phone: request.resident.phone,
      }
    : null,
  hostel: request.hostel
    ? {
        id: String(request.hostel._id),
        name: request.hostel.name,
        hostelCode: request.hostel.hostelCode,
      }
    : null,
  tenancy: request.tenancy
    ? {
        id: String(request.tenancy._id),
        roomNumber: request.tenancy.room?.roomNumber ?? null,
      }
    : null,
});

export const joinHostel = asyncHandler(async (req, res) => {
  const hostelCode = req.body.hostelCode?.trim().toUpperCase();
  if (!hostelCode) {
    throw new AppError("Hostel code is required", 400);
  }

  const user = await User.findById(req.user._id);
  if (user.role !== "resident") {
    throw new AppError("Only residents can join a hostel", 403);
  }

  if (user.hostelConnectionStatus === "active") {
    throw new AppError("You are already connected to a hostel", 400);
  }

  const activeTenancy = await Tenancy.findOne({
    resident: user._id,
    status: "active",
  });
  if (activeTenancy) {
    throw new AppError("You are already connected to a hostel", 400);
  }

  const pendingJoin = await JoinRequest.findOne({
    resident: user._id,
    status: "pending",
  });
  if (pendingJoin) {
    throw new AppError("You already have a pending join request", 400);
  }

  const hostel = await Hostel.findOne({ hostelCode });
  if (!hostel) {
    throw new AppError("Invalid hostel code", 404);
  }

  const tenancy = await findUnlinkedTenancyForUserInHostel(hostel._id, user);
  if (!tenancy) {
    throw new AppError(
      "You are not registered in this hostel. Please contact your hostel manager.",
      404,
    );
  }

  const joinRequest = await JoinRequest.create({
    resident: user._id,
    hostel: hostel._id,
    tenancy: tenancy._id,
    status: "pending",
  });

  user.hostelConnectionStatus = "pending";
  await user.save();

  const manager = await User.findById(hostel.manager).select("name").lean();
  if (manager) {
    await notifyUser(hostel.manager, {
      title: "New Resident Connection Request",
      body: `${user.name} requested to join ${hostel.name}.`,
      type: "join_request_created",
      data: {
        joinRequestId: String(joinRequest._id),
        hostelId: String(hostel._id),
      },
    });
  }

  return success(res, "Join request submitted successfully", {
    joinRequest: {
      id: String(joinRequest._id),
      status: joinRequest.status,
      hostel: {
        id: String(hostel._id),
        name: hostel.name,
        hostelCode: hostel.hostelCode,
      },
    },
  }, 201);
});

export const getManagerJoinRequests = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ manager: req.user._id }).select("_id").lean();
  const hostelIds = hostels.map((hostel) => hostel._id);

  const requests = await JoinRequest.find({
    hostel: { $in: hostelIds },
    status: "pending",
  })
    .populate("resident", "name phone")
    .populate("hostel", "name hostelCode")
    .populate({ path: "tenancy", populate: { path: "room", select: "roomNumber" } })
    .sort({ createdAt: -1 })
    .lean();

  return success(res, "Join requests fetched successfully", {
    requests: requests.map(formatJoinRequest),
  });
});

export const approveJoinRequest = asyncHandler(async (req, res) => {
  const joinRequest = await JoinRequest.findById(req.params.id)
    .populate("hostel")
    .populate("resident");

  if (!joinRequest || joinRequest.status !== "pending") {
    throw new AppError("Join request not found", 404);
  }

  const hostel = await getManagerHostel(joinRequest.hostel._id, req.user._id);
  if (!hostel) {
    throw new AppError("Not authorized for this request", 403);
  }

  const tenancy = await Tenancy.findById(joinRequest.tenancy).populate("room");
  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Resident record not found in this hostel", 404);
  }

  if (tenancy.resident) {
    throw new AppError("This resident record is already linked", 400);
  }

  const resident = await User.findById(joinRequest.resident._id);
  if (!resident) {
    throw new AppError("Resident account not found", 404);
  }

  await linkResidentToTenancy(resident, tenancy);
  await seedRentForNewTenancy(resident._id, tenancy.checkInDate);

  joinRequest.status = "approved";
  joinRequest.reviewedBy = req.user._id;
  joinRequest.approvedAt = new Date();
  await joinRequest.save();

  await JoinRequest.updateMany(
    {
      resident: resident._id,
      status: "pending",
      _id: { $ne: joinRequest._id },
    },
    {
      $set: {
        status: "rejected",
        reviewedBy: req.user._id,
        rejectedAt: new Date(),
      },
    },
  );

  await notifyUser(resident._id, {
    title: "Join Request Approved",
    body: `You are now connected to ${hostel.name}.`,
    type: "join_request_approved",
    data: {
      hostelId: String(hostel._id),
      tenancyId: String(tenancy._id),
    },
  });

  return success(res, "Join request approved successfully", {
    request: formatJoinRequest({
      ...joinRequest.toObject(),
      resident,
      hostel,
      tenancy,
    }),
  });
});

export const rejectJoinRequest = asyncHandler(async (req, res) => {
  const joinRequest = await JoinRequest.findById(req.params.id).populate(
    "hostel resident",
  );

  if (!joinRequest || joinRequest.status !== "pending") {
    throw new AppError("Join request not found", 404);
  }

  const hostel = await getManagerHostel(joinRequest.hostel._id, req.user._id);
  if (!hostel) {
    throw new AppError("Not authorized for this request", 403);
  }

  joinRequest.status = "rejected";
  joinRequest.reviewedBy = req.user._id;
  joinRequest.rejectedAt = new Date();
  await joinRequest.save();

  const resident = await User.findById(joinRequest.resident._id);
  if (resident) {
    const otherPending = await JoinRequest.exists({
      resident: resident._id,
      status: "pending",
    });
    if (!otherPending) {
      resident.hostelConnectionStatus = "not_connected";
      await resident.save();
    }

    await notifyUser(resident._id, {
      title: "Join Request Rejected",
      body: `Your request to join ${hostel.name} was not approved.`,
      type: "join_request_rejected",
      data: { hostelId: String(hostel._id) },
    });
  }

  return success(res, "Join request rejected successfully", {
    request: formatJoinRequest(joinRequest),
  });
});

export const createLeaveRequest = asyncHandler(async (req, res) => {
  const { leavingDate, reason, notes, requestedRefundAmount } = req.body;
  const user = await User.findById(req.user._id);

  if (user.role !== "resident") {
    throw new AppError("Only residents can submit leave requests", 403);
  }

  if (user.hostelConnectionStatus !== "active") {
    throw new AppError("You are not connected to a hostel", 400);
  }

  const tenancy = await Tenancy.findOne({
    resident: user._id,
    status: "active",
  }).populate("hostel");

  if (!tenancy) {
    throw new AppError("You are not connected to a hostel", 400);
  }

  const existing = await LeaveRequest.findOne({
    resident: user._id,
    status: "pending",
  });
  if (existing) {
    throw new AppError("You already have a pending leave request", 400);
  }

  const parsedLeavingDate = new Date(leavingDate);
  if (Number.isNaN(parsedLeavingDate.getTime())) {
    throw new AppError("Valid leaving date is required", 400);
  }

  const securityDepositHeld = tenancy.securityDeposit ?? 0;
  let parsedRequestedRefund = null;

  if (
    requestedRefundAmount !== undefined &&
    requestedRefundAmount !== null &&
    requestedRefundAmount !== ""
  ) {
    parsedRequestedRefund = Number(requestedRefundAmount);
    if (Number.isNaN(parsedRequestedRefund) || parsedRequestedRefund < 0) {
      throw new AppError("requestedRefundAmount must be a non-negative number", 400);
    }
    if (parsedRequestedRefund > securityDepositHeld) {
      throw new AppError(
        "Requested refund cannot exceed your security deposit",
        400,
      );
    }
  }

  const leaveRequest = await LeaveRequest.create({
    resident: user._id,
    hostel: tenancy.hostel._id,
    tenancy: tenancy._id,
    leavingDate: parsedLeavingDate,
    reason: reason.trim(),
    notes: notes?.trim() || null,
    securityDepositHeld,
    requestedRefundAmount: parsedRequestedRefund,
    status: "pending",
  });

  await notifyUser(tenancy.hostel.manager, {
    title: "New Leave Request",
    body: `${user.name} requested to leave ${tenancy.hostel.name}.`,
    type: "leave_request_created",
    data: {
      leaveRequestId: String(leaveRequest._id),
      hostelId: String(tenancy.hostel._id),
    },
  });

  const daysUntilLeave = Math.ceil(
    (parsedLeavingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return success(res, "Leave request submitted successfully", {
    leaveRequest: {
      id: String(leaveRequest._id),
      status: leaveRequest.status,
      leavingDate: leaveRequest.leavingDate,
      securityDepositHeld,
      requestedRefundAmount: parsedRequestedRefund,
      daysUntilLeave,
      shortNotice: daysUntilLeave < 30,
    },
  }, 201);
});

export const getManagerLeaveRequests = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ manager: req.user._id }).select("_id").lean();
  const hostelIds = hostels.map((hostel) => hostel._id);

  const requests = await LeaveRequest.find({
    hostel: { $in: hostelIds },
    status: "pending",
  })
    .populate("resident", "name phone")
    .populate("hostel", "name hostelCode")
    .populate({
      path: "tenancy",
      select: "securityDeposit",
      populate: { path: "room", select: "roomNumber" },
    })
    .sort({ createdAt: -1 })
    .lean();

  return success(res, "Leave requests fetched successfully", {
    requests: requests.map((request) => ({
      id: String(request._id),
      status: request.status,
      leavingDate: request.leavingDate,
      reason: request.reason,
      notes: request.notes,
      securityDepositHeld: request.securityDepositHeld ?? 0,
      requestedRefundAmount: request.requestedRefundAmount ?? null,
      createdAt: request.createdAt,
      resident: request.resident
        ? {
            id: String(request.resident._id),
            name: request.resident.name,
            phone: request.resident.phone,
          }
        : null,
      hostel: request.hostel
        ? {
            id: String(request.hostel._id),
            name: request.hostel.name,
            hostelCode: request.hostel.hostelCode,
          }
        : null,
      tenancy: request.tenancy
        ? {
            id: String(request.tenancy._id),
            roomNumber: request.tenancy.room?.roomNumber ?? null,
            securityDeposit: request.tenancy.securityDeposit ?? 0,
          }
        : null,
    })),
  });
});

export const approveLeaveRequest = asyncHandler(async (req, res) => {
  const { refundAmount } = req.body;

  const leaveRequest = await LeaveRequest.findById(req.params.id)
    .populate("hostel")
    .populate("resident");

  if (!leaveRequest || leaveRequest.status !== "pending") {
    throw new AppError("Leave request not found", 404);
  }

  const hostel = await getManagerHostel(leaveRequest.hostel._id, req.user._id);
  if (!hostel) {
    throw new AppError("Not authorized for this request", 403);
  }

  const tenancy = await Tenancy.findById(leaveRequest.tenancy).populate("room");
  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Active tenancy not found", 404);
  }

  const depositHeld =
    leaveRequest.securityDepositHeld ?? tenancy.securityDeposit ?? 0;
  let parsedRefund = 0;

  if (refundAmount !== undefined && refundAmount !== null && refundAmount !== "") {
    parsedRefund = Number(refundAmount);
    if (Number.isNaN(parsedRefund) || parsedRefund < 0) {
      throw new AppError("refundAmount must be a non-negative number", 400);
    }
    if (parsedRefund > depositHeld) {
      throw new AppError(
        "Refund amount cannot exceed the security deposit held",
        400,
      );
    }
  }

  tenancy.status = "moved_out";
  tenancy.checkOutDate = leaveRequest.leavingDate;
  await tenancy.save();
  await syncRoomStatus(tenancy.room._id);

  const resident = await User.findById(leaveRequest.resident._id);
  if (resident) {
    resident.hostelConnectionStatus = "not_connected";
    await resident.save();
  }

  let refundExpense = null;
  if (parsedRefund > 0) {
    const leaveDate = new Date(leaveRequest.leavingDate);
    const roomNumber = tenancy.room?.roomNumber ?? "—";

    refundExpense = await Expense.create({
      manager: req.user._id,
      hostel: hostel._id,
      title: `Security deposit refund - ${resident?.name ?? "Resident"}`,
      details: [
        `Refund approved for leave on ${leaveDate.toISOString().slice(0, 10)}.`,
        `Room ${roomNumber}.`,
        leaveRequest.reason ? `Reason: ${leaveRequest.reason}` : null,
        leaveRequest.requestedRefundAmount != null
          ? `Resident requested Rs ${leaveRequest.requestedRefundAmount.toLocaleString()}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      amount: parsedRefund,
      month: leaveDate.getMonth() + 1,
      year: leaveDate.getFullYear(),
      expenseDate: leaveDate,
    });
  }

  leaveRequest.status = "approved";
  leaveRequest.reviewedBy = req.user._id;
  leaveRequest.approvedAt = new Date();
  leaveRequest.approvedRefundAmount = parsedRefund;
  leaveRequest.refundExpense = refundExpense?._id ?? null;
  await leaveRequest.save();

  await notifyUser(resident._id, {
    title: "Leave Request Approved",
    body:
      parsedRefund > 0
        ? `Your leave from ${hostel.name} has been approved. Security deposit refund: Rs ${parsedRefund.toLocaleString()}.`
        : `Your leave from ${hostel.name} has been approved.`,
    type: "leave_request_approved",
    data: {
      hostelId: String(hostel._id),
      refundAmount: String(parsedRefund),
    },
  });

  return success(res, "Leave request approved successfully", {
    approvedRefundAmount: parsedRefund,
    expenseId: refundExpense ? String(refundExpense._id) : null,
  });
});

export const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const leaveRequest = await LeaveRequest.findById(req.params.id).populate(
    "hostel resident",
  );

  if (!leaveRequest || leaveRequest.status !== "pending") {
    throw new AppError("Leave request not found", 404);
  }

  const hostel = await getManagerHostel(leaveRequest.hostel._id, req.user._id);
  if (!hostel) {
    throw new AppError("Not authorized for this request", 403);
  }

  leaveRequest.status = "rejected";
  leaveRequest.reviewedBy = req.user._id;
  leaveRequest.rejectedAt = new Date();
  await leaveRequest.save();

  await notifyUser(leaveRequest.resident._id, {
    title: "Leave Request Rejected",
    body: `Your leave request for ${hostel.name} was not approved.`,
    type: "leave_request_rejected",
    data: { hostelId: String(hostel._id) },
  });

  return success(res, "Leave request rejected successfully");
});
