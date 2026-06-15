import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { requireManagerHostel } from "../utils/hostelHelpers.js";

export const createHostel = asyncHandler(async (req, res) => {
  const { name, address, city, contactPhone } = req.body;

  const hostel = await Hostel.create({
    name,
    address,
    city,
    contactPhone,
    manager: req.user._id,
  });

  return success(res, "Hostel created successfully", { hostel }, 201);
});

export const getHostels = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [hostels, total] = await Promise.all([
    Hostel.find()
      .select("name address city contactPhone createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Hostel.countDocuments(),
  ]);

  return success(res, "Hostels fetched successfully", {
    hostels,
    pagination: buildPagination(total, page, limit),
  });
});

export const getMyHostels = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ manager: req.user._id })
    .select("name address city contactPhone createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return success(res, "Your hostels fetched successfully", { hostels });
});

export const getHostelById = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findOne({
    _id: req.params.hostelId,
    manager: req.user._id,
  }).lean();

  if (!hostel) {
    throw new AppError("Hostel not found", 404);
  }

  return success(res, "Hostel fetched successfully", { hostel });
});

export const updateHostel = asyncHandler(async (req, res) => {
  const { name, address, city, contactPhone } = req.body;

  const hostel = await requireManagerHostel(req.params.hostelId, req.user._id);

  if (name) hostel.name = name;
  if (address) hostel.address = address;
  if (city) hostel.city = city;
  if (contactPhone) hostel.contactPhone = contactPhone;

  await hostel.save();

  return success(res, "Hostel updated successfully", { hostel });
});

export const deleteHostel = asyncHandler(async (req, res) => {
  const hostel = await requireManagerHostel(req.params.hostelId, req.user._id);

  const activeResidents = await Tenancy.countDocuments({
    hostel: hostel._id,
    status: "active",
  });

  if (activeResidents > 0) {
    throw new AppError(
      "Cannot delete hostel with active residents. Remove all residents first.",
      400
    );
  }

  await Room.deleteMany({ hostel: hostel._id });
  await hostel.deleteOne();

  return success(res, "Hostel deleted successfully");
});
