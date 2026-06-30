import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import JoinRequest from "../models/JoinRequest.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import {
  applyTenancyProfileFields,
  createHostelResidentRecord,
  findRoomInHostel,
  formatResident,
  formatResidentLookup,
  getActiveTenancyCount,
  getManagerHostel,
  linkResidentToTenancy,
  syncRoomStatus,
} from "../utils/residentHelpers.js";
import { RESIDENT_PROFILE_FIELDS } from "../utils/validationHelpers.js";
import Payment from "../models/Payment.js";
import { getTenancyMonthlyRent, ensureResidentRentRecord, ensurePaymentForTenancy, seedRentForNewTenancy } from "../utils/rentHelpers.js";
import {
  buildRentReminderBody,
  notifyRentReminder,
} from "../utils/rentNotificationHelpers.js";
import { notifyUser } from "../services/pushNotificationService.js";
import {
  assertCanAddTenant,
  assertHasFeature,
  PLAN_FEATURES,
} from "../utils/subscriptionHelpers.js";

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

const resolveSecurityDeposit = (securityDeposit) => {
  if (
    securityDeposit === undefined ||
    securityDeposit === null ||
    securityDeposit === ""
  ) {
    return 0;
  }

  const parsed = Number(securityDeposit);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new AppError("securityDeposit must be a non-negative number", 400);
  }

  return parsed;
};

export const lookupResidentByUserId = asyncHandler(async (req, res) => {
  const userId = req.params.userId?.trim();

  if (!userId) {
    throw new AppError("Resident user ID is required", 400);
  }

  const user = await User.findOne({ userId, role: "resident" }).select(
    RESIDENT_PROFILE_FIELDS,
  );

  if (!user) {
    throw new AppError("No resident account found with this User ID", 404);
  }

  return success(res, "Resident profile fetched successfully", {
    resident: await formatResidentLookup(user),
  });
});

export const addResident = asyncHandler(async (req, res) => {
  const {
    hostelId,
    name,
    phone,
    cnic,
    address,
    email,
    dateOfBirth,
    roomNumber,
    monthlyRent,
    securityDeposit,
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
    checkInDate,
    residentUserId,
  } = req.body;

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  await assertCanAddTenant(req.user);

  const room = await findRoomInHostel(hostel._id, roomNumber);
  if (!room) throw new AppError("Room not found in this hostel", 404);

  const activeInRoom = await getActiveTenancyCount(room._id);
  if (activeInRoom >= room.capacity) {
    throw new AppError("Room is already full", 400);
  }

  let tenancy;
  try {
    tenancy = await createHostelResidentRecord({
      hostelId: hostel._id,
      roomId: room._id,
      name,
      phone,
      cnic,
      address,
      email,
      dateOfBirth,
      profileImage,
      cnicFront,
      cnicBack,
      emergencyNumber,
      fatherName,
      fatherPhone,
      monthlyRent: resolveTenancyMonthlyRent(monthlyRent, room.rent),
      securityDeposit: resolveSecurityDeposit(securityDeposit),
      checkInDate,
      residentUserId,
    });
  } catch (error) {
    if (error.message === "PHONE_IN_USE") {
      throw new AppError("This phone number belongs to a non-resident account", 400);
    }
    if (error.message === "RESIDENT_ALREADY_IN_HOSTEL") {
      throw new AppError("This phone number is already registered in this hostel", 400);
    }
    if (error.message === "RESIDENT_USER_NOT_FOUND") {
      throw new AppError("No resident account found with this User ID", 404);
    }
    if (error.message === "PHONE_MISMATCH") {
      throw new AppError(
        "Phone number does not match the resident account for this User ID",
        400,
      );
    }
    if (error.message === "RESIDENT_ALREADY_CONNECTED") {
      throw new AppError(
        "This resident is already connected to another hostel",
        400,
      );
    }
    throw error;
  }

  let linked = false;
  if (residentUserId) {
    const resident = await User.findOne({
      userId: residentUserId.trim(),
      role: "resident",
    });

    if (!resident) {
      throw new AppError("No resident account found with this User ID", 404);
    }

    await linkResidentToTenancy(resident, tenancy);
    await seedRentForNewTenancy(resident._id, tenancy.checkInDate);

    await JoinRequest.updateMany(
      { resident: resident._id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedBy: req.user._id,
          rejectedAt: new Date(),
        },
      },
    );

    await notifyUser(resident._id, {
      title: "Added to hostel",
      body: `You have been added to ${hostel.name}. Your account is now connected.`,
      type: "resident_linked_by_manager",
      data: {
        hostelId: String(hostel._id),
        tenancyId: String(tenancy._id),
      },
    });

    linked = true;
  }

  await syncRoomStatus(room._id);

  if (!linked) {
    await tenancy.populate("room");
    const checkIn = tenancy.checkInDate ?? new Date();
    await ensurePaymentForTenancy(
      tenancy,
      checkIn.getMonth() + 1,
      checkIn.getFullYear(),
    );
  }

  const populated = await Tenancy.findById(tenancy._id)
    .populate("resident", RESIDENT_PROFILE_FIELDS)
    .populate("room", "roomNumber rent");

  const message = linked
    ? "Resident added and linked to their Osstel account successfully."
    : "Resident added successfully. They can sign up in the app and join using the hostel code.";

  return success(
    res,
    message,
    {
      resident: formatResident(populated),
      linked,
    },
    201,
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
    securityDeposit,
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
    address,
    email,
    dateOfBirth,
  } = req.body;

  const tenancy = await Tenancy.findById(req.params.id)
    .populate("resident", `${RESIDENT_PROFILE_FIELDS} role`)
    .populate("room", "roomNumber capacity rent");

  if (!tenancy || tenancy.status !== "active") {
    throw new AppError("Resident not found", 404);
  }

  const hostel = await getManagerHostel(tenancy.hostel, req.user._id);
  if (!hostel) throw new AppError("Not authorized for this hostel", 403);

  const isLinked = Boolean(tenancy.resident);

  if (isLinked) {
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
        emergencyNumber === "" || emergencyNumber === null
          ? null
          : emergencyNumber;
    }
    if (fatherName !== undefined) {
      tenancy.resident.fatherName =
        fatherName === "" || fatherName === null ? null : fatherName;
    }
    if (fatherPhone !== undefined) {
      tenancy.resident.fatherPhone =
        fatherPhone === "" || fatherPhone === null ? null : fatherPhone;
    }
    if (email !== undefined) {
      tenancy.resident.email = email === "" || email === null ? null : email;
    }
    if (dateOfBirth !== undefined) {
      tenancy.resident.dateOfBirth =
        dateOfBirth === "" || dateOfBirth === null
          ? null
          : new Date(dateOfBirth);
    }
    if (address !== undefined) {
      tenancy.resident.address =
        address === "" || address === null ? null : address;
      tenancy.address =
        address === "" || address === null ? null : address;
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
      tenancy.phone = phone;
    }
  } else {
    applyTenancyProfileFields(tenancy, {
      name,
      phone,
      cnic,
      address,
      email,
      dateOfBirth,
      profileImage,
      cnicFront,
      cnicBack,
      emergencyNumber,
      fatherName,
      fatherPhone,
    });

    if (phone && phone !== tenancy.phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        throw new AppError("Phone number already in use", 400);
      }
    }
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

    if (isLinked) {
      const now = new Date();
      const newBase = getTenancyMonthlyRent(tenancy);
      const pendingPayments = await Payment.find({
        resident: tenancy.resident._id,
        room: tenancy.room._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        status: { $in: ["pending", "rejected"] },
      });

      for (const pendingPayment of pendingPayments) {
        pendingPayment.baseAmount = newBase;
        const chargesTotal = (pendingPayment.charges ?? []).reduce(
          (sum, charge) => sum + (charge.amount ?? 0),
          0,
        );
        pendingPayment.amount = Math.round((newBase + chargesTotal) * 100) / 100;
        await pendingPayment.save();
      }
    }
  }

  if (securityDeposit !== undefined) {
    tenancy.securityDeposit = resolveSecurityDeposit(securityDeposit);
  }

  await tenancy.save();
  if (isLinked) {
    await tenancy.resident.save();
  }

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

  if (!tenancy.resident) {
    throw new AppError("Resident has not connected their account yet", 400);
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

  assertHasFeature(req.user, PLAN_FEATURES.rent_reminders);

  const residentId = tenancy.resident._id ?? tenancy.resident;

  await notifyRentReminder(residentId, payment, {
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

  if (tenancy.resident) {
    const resident = await User.findById(tenancy.resident);
    if (resident) {
      resident.hostelConnectionStatus = "not_connected";
      await resident.save();
    }
  }

  return success(res, "Resident removed successfully");
});
