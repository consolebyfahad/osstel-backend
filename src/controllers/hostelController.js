import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import Payment from "../models/Payment.js";
import Complaint from "../models/Complaint.js";
import Expense from "../models/Expense.js";
import JoinRequest from "../models/JoinRequest.js";
import LeaveRequest from "../models/LeaveRequest.js";
import RoomMeter from "../models/RoomMeter.js";
import MeterReading from "../models/MeterReading.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { requireManagerHostel } from "../utils/hostelHelpers.js";
import { assertCanAddHostel } from "../utils/subscriptionHelpers.js";
import { fetchHostelDirectory } from "../utils/hostelDirectoryHelpers.js";
import { generateUniqueHostelCode, ensureHostelCode } from "../utils/hostelCodeHelpers.js";

export const createHostel = asyncHandler(async (req, res) => {
  await assertCanAddHostel(req.user);

  const { name, address, city, contactPhone, image } = req.body;

  let hostelCode;
  try {
    hostelCode = await generateUniqueHostelCode();
  } catch {
    throw new AppError("Could not generate hostel code. Please try again.", 500);
  }

  const hostel = await Hostel.create({
    name,
    address,
    city,
    contactPhone,
    image: image || null,
    hostelCode,
    manager: req.user._id,
  });

  return success(res, "Hostel created successfully", { hostel }, 201);
});

export const getMyHostels = asyncHandler(async (req, res) => {
  const hostelsRaw = await Hostel.find({ manager: req.user._id })
    .select("name address city contactPhone hostelCode image createdAt")
    .sort({ createdAt: -1 });

  const hostels = await Promise.all(
    hostelsRaw.map(async (hostel) => {
      const code = await ensureHostelCode(hostel);
      return {
        ...hostel.toObject(),
        hostelCode: code,
      };
    }),
  );

  return success(res, "Your hostels fetched successfully", { hostels });
});

export const discoverHostels = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;
  const includeContacts = Boolean(req.user);

  const result = await fetchHostelDirectory({
    search,
    page,
    limit,
    skip,
    excludeBlockedOwners: true,
    includeOwnerPlan: false,
    includeContacts,
  });

  return success(res, "Hostels fetched successfully", result);
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
  const { name, address, city, contactPhone, image } = req.body;

  const hostel = await requireManagerHostel(req.params.hostelId, req.user._id);

  if (name) hostel.name = name;
  if (address) hostel.address = address;
  if (city) hostel.city = city;
  if (contactPhone) hostel.contactPhone = contactPhone;
  if (image !== undefined) {
    hostel.image = image === "" || image === null ? null : image;
  }

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

  const [
    pendingPayments,
    openComplaints,
    expensesCount,
    joinRequestsCount,
    leaveRequestsCount,
  ] = await Promise.all([
    Payment.countDocuments({
      hostel: hostel._id,
      status: { $in: ["pending", "review", "rejected"] },
    }),
    Complaint.countDocuments({
      hostel: hostel._id,
      status: { $in: ["open", "in_progress"] },
    }),
    Expense.countDocuments({ hostel: hostel._id }),
    JoinRequest.countDocuments({
      hostel: hostel._id,
      status: { $in: ["pending", "approved"] },
    }),
    LeaveRequest.countDocuments({
      hostel: hostel._id,
      status: { $in: ["pending", "approved"] },
    }),
  ]);

  if (
    pendingPayments > 0 ||
    openComplaints > 0 ||
    expensesCount > 0 ||
    joinRequestsCount > 0 ||
    leaveRequestsCount > 0
  ) {
    throw new AppError(
      "Cannot delete hostel with financial records, complaints, or pending connection requests. Archive data first.",
      400,
    );
  }

  const roomIds = await Room.find({ hostel: hostel._id }).distinct("_id");

  await Promise.all([
    MeterReading.deleteMany({ room: { $in: roomIds } }),
    RoomMeter.deleteMany({ hostel: hostel._id }),
    Payment.deleteMany({ hostel: hostel._id }),
    Tenancy.deleteMany({ hostel: hostel._id }),
    Room.deleteMany({ hostel: hostel._id }),
  ]);

  await hostel.deleteOne();

  return success(res, "Hostel deleted successfully");
});
