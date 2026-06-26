import Complaint from "../models/Complaint.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getManagerHostel } from "../utils/hostelHelpers.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { notifyUser } from "../services/pushNotificationService.js";
import {
  formatComplaint,
  formatComplaints,
  getActiveTenancy,
} from "../utils/complaintHelpers.js";
import {
  assertHasFeature,
  assertResidentManagerFeature,
  PLAN_FEATURES,
} from "../utils/subscriptionHelpers.js";

export const createComplaint = asyncHandler(async (req, res) => {
  await assertResidentManagerFeature(req.user._id, PLAN_FEATURES.complaints);
  const { title, description } = req.body;

  const tenancy = await getActiveTenancy(req.user._id);
  if (!tenancy) {
    throw new AppError("No active hostel tenancy found", 400);
  }

  const complaint = await Complaint.create({
    resident: req.user._id,
    hostel: tenancy.hostel._id,
    room: tenancy.room?._id ?? null,
    title,
    description,
  });

  const populated = await Complaint.findById(complaint._id)
    .populate("hostel", "name manager")
    .populate("room", "roomNumber")
    .lean();

  if (tenancy.hostel?.manager) {
    void notifyUser(tenancy.hostel.manager, {
      title: "New complaint",
      body: title,
      type: "complaint_created",
      data: {
        complaintId: complaint._id.toString(),
        url: "/complaints",
      },
    });
  }

  return success(
    res,
    "Complaint submitted successfully",
    { complaint: formatComplaint(populated) },
    201,
  );
});

export const getMyComplaints = asyncHandler(async (req, res) => {
  await assertResidentManagerFeature(req.user._id, PLAN_FEATURES.complaints);
  const { status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = { resident: req.user._id };
  if (status) filter.status = status;

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate("hostel", "name")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  return success(res, "Your complaints fetched successfully", {
    complaints: formatComplaints(complaints),
    pagination: buildPagination(total, page, limit),
  });
});

export const getComplaints = asyncHandler(async (req, res) => {
  assertHasFeature(req.user, PLAN_FEATURES.complaints);
  const { hostelId, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!hostelId) throw new AppError("hostelId is required", 400);

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const filter = { hostel: hostel._id };
  if (status) filter.status = status;

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate("resident", "name phone")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  return success(res, "Complaints fetched successfully", {
    complaints: formatComplaints(complaints),
    pagination: buildPagination(total, page, limit),
  });
});

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  assertHasFeature(req.user, PLAN_FEATURES.complaints);
  const { status } = req.body;

  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) throw new AppError("Complaint not found", 404);

  const hostel = await getManagerHostel(complaint.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  complaint.status = status;
  await complaint.save();

  const populated = await Complaint.findById(complaint._id)
    .populate("resident", "name phone")
    .populate("room", "roomNumber")
    .populate("hostel", "name")
    .lean();

  void notifyUser(complaint.resident, {
    title: "Complaint updated",
    body: `Your complaint is now ${status.replace(/_/g, " ")}`,
    type: "complaint_updated",
    data: {
      complaintId: complaint._id.toString(),
      url: "/complaints",
    },
  });

  return success(res, "Complaint updated successfully", {
    complaint: formatComplaint(populated),
  });
});
