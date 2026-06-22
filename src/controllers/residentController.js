import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import {
  findOrCreateResident,
  findRoomInHostel,
  formatResident,
  getActiveTenancyCount,
  getManagerHostel,
  syncRoomStatus,
} from "../utils/residentHelpers.js";
import { RESIDENT_PROFILE_FIELDS } from "../utils/validationHelpers.js";
import Payment from "../models/Payment.js";
import { getTenancyMonthlyRent, ensureResidentRentRecord, seedRentForNewTenancy } from "../utils/rentHelpers.js";
import {
  buildRentReminderBody,
  notifyRentReminder,
} from "../utils/rentNotificationHelpers.js";

const resolveTenancyMonthlyRent = (monthlyRent, roomRent) => {
  if (monthlyRent === undefined || monthlyRent === null || monthlyRent === "") {
    return null;
  }

  const parsed = Number(monthlyRent);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new AppError("monthlyRent must be a non-negative number", 400);
  }

  return parsed === roomRent ? null : parsed;
};

export const addResident = asyncHandler(async (req, res) => {
  const {
    hostelId,
    name,
    phone,
    cnic,
    roomNumber,
    monthlyRent,
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
  } = req.body;

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const room = await findRoomInHostel(hostel._id, roomNumber);
  if (!room) throw new AppError("Room not found in this hostel", 404);

  const activeInRoom = await getActiveTenancyCount(room._id);
  if (activeInRoom >= room.capacity) {
    throw new AppError("Room is already full", 400);
  }

  let resident;
  let loginCredentials = null;
  try {
    ({ resident, loginCredentials } = await findOrCreateResident({
      name,
      phone,
      cnic,
      profileImage,
      cnicFront,
      cnicBack,
      emergencyNumber,
      fatherName,
      fatherPhone,
    }));
  } catch (error) {
    if (error.message === "PHONE_IN_USE") {
      throw new AppError("This phone number belongs to a non-resident account", 400);
    }
    if (error.message === "USER_ID_GENERATION_FAILED") {
      throw new AppError("Could not generate resident user ID. Please try again.", 500);
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      if (field === "phone") {
        throw new AppError("This phone number is already registered", 400);
      }
    }
    throw error;
  }

  const existingTenancy = await Tenancy.findOne({
    resident: resident._id,
    hostel: hostel._id,
    status: "active",
  });

  if (existingTenancy) {
    throw new AppError("Resident already has an active room in this hostel", 400);
  }

  const tenancy = await Tenancy.create({
    resident: resident._id,
    room: room._id,
    hostel: hostel._id,
    checkInDate: new Date(),
    status: "active",
    monthlyRent: resolveTenancyMonthlyRent(monthlyRent, room.rent),
  });

  await syncRoomStatus(room._id);
  await seedRentForNewTenancy(resident._id, tenancy.checkInDate);

  const populated = await Tenancy.findById(tenancy._id)
    .populate("resident", RESIDENT_PROFILE_FIELDS)
    .populate("room", "roomNumber rent");

  return success(
    res,
    loginCredentials
      ? "Resident added successfully. Share login credentials with the tenant."
      : "Resident added successfully",
    {
      resident: formatResident(populated),
      ...(loginCredentials ? { loginCredentials } : {}),
    },
    201
  );
});

export const getResidents = asyncHandler(async (req, res) => {
  const { hostelId, roomId, roomNumber } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!hostelId) throw new AppError("hostelId is required", 400);

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const filter = { hostel: hostel._id, status: "active" };

  if (roomId) {
    filter.room = roomId;
  } else if (roomNumber) {
    const room = await findRoomInHostel(hostel._id, roomNumber);
    if (!room) throw new AppError("Room not found in this hostel", 404);
    filter.room = room._id;
  }

  const [tenancies, total] = await Promise.all([
    Tenancy.find(filter)
      .populate("resident", RESIDENT_PROFILE_FIELDS)
      .populate("room", "roomNumber rent")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenancy.countDocuments(filter),
  ]);

  return success(res, "Residents fetched successfully", {
    residents: tenancies.map(formatResident),
    pagination: buildPagination(total, page, limit),
  });
});

export const updateResident = asyncHandler(async (req, res) => {
  const {
    name,
    phone,
    cnic,
    roomNumber,
    monthlyRent,
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
  } = req.body;

  const tenancy = await Tenancy.findById(req.params.id)
    .populate("resident", `${RESIDENT_PROFILE_FIELDS} role`)
    .populate("room", "roomNumber capacity rent");

  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Resident not found", 404);
  }

  const hostel = await getManagerHostel(tenancy.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  if (name) tenancy.resident.name = name;
  if (cnic !== undefined) tenancy.resident.cnic = cnic;

  if (profileImage !== undefined) {
    tenancy.resident.profileImage =
      profileImage === "" || profileImage === null ? null : profileImage;
  }
  if (cnicFront !== undefined) {
    tenancy.resident.cnicFront =
      cnicFront === "" || cnicFront === null ? null : cnicFront;
  }
  if (cnicBack !== undefined) {
    tenancy.resident.cnicBack =
      cnicBack === "" || cnicBack === null ? null : cnicBack;
  }
  if (emergencyNumber !== undefined) {
    tenancy.resident.emergencyNumber =
      emergencyNumber === "" || emergencyNumber === null ? null : emergencyNumber;
  }
  if (fatherName !== undefined) {
    tenancy.resident.fatherName =
      fatherName === "" || fatherName === null ? null : fatherName;
  }
  if (fatherPhone !== undefined) {
    tenancy.resident.fatherPhone =
      fatherPhone === "" || fatherPhone === null ? null : fatherPhone;
  }

  if (phone && phone !== tenancy.resident.phone) {
    const existingUser = await User.findOne({ phone });
    if (
      existingUser &&
      existingUser._id.toString() !== tenancy.resident._id.toString()
    ) {
      throw new AppError("Phone number already in use", 400);
    }
    tenancy.resident.phone = phone;
  }

  if (roomNumber && roomNumber !== tenancy.room.roomNumber) {
    const newRoom = await findRoomInHostel(tenancy.hostel, roomNumber);
    if (!newRoom) throw new AppError("Room not found in this hostel", 404);

    const activeInNewRoom = await getActiveTenancyCount(newRoom._id);
    if (
      newRoom._id.toString() !== tenancy.room._id.toString() &&
      activeInNewRoom >= newRoom.capacity
    ) {
      throw new AppError("Room is already full", 400);
    }

    const oldRoomId = tenancy.room._id;
    tenancy.room = newRoom._id;
    await tenancy.save();
    await tenancy.populate("room", "roomNumber capacity rent");
    await syncRoomStatus(oldRoomId);
    await syncRoomStatus(newRoom._id);
  }

  if (monthlyRent !== undefined) {
    tenancy.monthlyRent = resolveTenancyMonthlyRent(
      monthlyRent,
      tenancy.room.rent,
    );

    const now = new Date();
    await Payment.updateMany(
      {
        resident: tenancy.resident._id,
        room: tenancy.room._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: { $in: ["pending", "rejected"] },
      },
      { $set: { amount: getTenancyMonthlyRent(tenancy) } },
    );
  }

  await tenancy.save();
  await tenancy.resident.save();

  const updated = await Tenancy.findById(tenancy._id)
    .populate("resident", RESIDENT_PROFILE_FIELDS)
    .populate("room", "roomNumber rent");

  return success(res, "Resident updated successfully", {
    resident: formatResident(updated),
  });
});

export const sendResidentRentAlert = asyncHandler(async (req, res) => {
  const tenancy = await Tenancy.findById(req.params.id).populate("room");

  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Resident not found", 404);
  }

  const hostel = await getManagerHostel(tenancy.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { payment } = await ensureResidentRentRecord(
    tenancy.resident,
    month,
    year,
  );

  if (!payment) {
    throw new AppError("No rent record found for this resident", 404);
  }

  if (!["pending", "rejected"].includes(payment.status)) {
    throw new AppError(
      "Rent alert is only available for pending or rejected payments",
      400,
    );
  }

  const customMessage = req.body.message?.trim();

  await notifyRentReminder(tenancy.resident, payment, {
    type: "rent_alert_manual",
    title: "Rent payment reminder",
    body:
      customMessage ||
      buildRentReminderBody(payment.month, payment.year, payment.amount),
  });

  return success(res, "Rent alert sent successfully", {
    paymentId: payment._id.toString(),
  });
});

export const removeResident = asyncHandler(async (req, res) => {
  const tenancy = await Tenancy.findById(req.params.id).populate("room");

  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Resident not found", 404);
  }

  const hostel = await getManagerHostel(tenancy.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  tenancy.status = "moved_out";
  tenancy.checkOutDate = new Date();
  await tenancy.save();
  await syncRoomStatus(tenancy.room._id);

  return success(res, "Resident removed successfully");
});
