import Complaint from "../models/Complaint.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getManagerHostel } from "../utils/hostelHelpers.js";
import { buildPagination, getPagination } from "../utils/pagination.js";

export const createComplaint = asyncHandler(async (req, res) => {
  const { title, description, hostelId, roomId } = req.body;

  const complaint = await Complaint.create({
    resident: req.user._id,
    hostel: hostelId,
    room: roomId || null,
    title,
    description,
  });

  return success(res, "Complaint submitted successfully", { complaint }, 201);
});

export const getComplaints = asyncHandler(async (req, res) => {
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
    complaints,
    pagination: buildPagination(total, page, limit),
  });
});

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) throw new AppError("Complaint not found", 404);

  const hostel = await getManagerHostel(complaint.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  complaint.status = status;
  await complaint.save();

  return success(res, "Complaint updated successfully", { complaint });
});
