import Hostel from "../models/Hostel.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getManagerUsage } from "../utils/subscriptionHelpers.js";

const buildProfile = async (user) => {
  const profile = {
    id: user._id,
    name: user.name,
    phone: user.phone,
    userId: user.userId || null,
    email: user.email || null,
    address: user.address || null,
    dateOfBirth: user.dateOfBirth
      ? user.dateOfBirth.toISOString().split("T")[0]
      : null,
    cnic: user.cnic || null,
    profileImage: user.profileImage || null,
    cnicFront: user.cnicFront || null,
    cnicBack: user.cnicBack || null,
    emergencyNumber: user.emergencyNumber || null,
    fatherName: user.fatherName || null,
    fatherPhone: user.fatherPhone || null,
    role: user.role,
    subscriptionPlan:
      user.subscriptionPlan === "basic"
        ? "standard"
        : user.subscriptionPlan || "free",
    hostels: [],
    hostel: null,
    room: null,
    tenancyId: null,
    checkInDate: null,
  };

  if (user.role === "manager") {
    const hostels = await Hostel.find({ manager: user._id })
      .select("name address city contactPhone")
      .sort({ createdAt: -1 })
      .lean();

    profile.hostels = hostels.map((hostel) => ({
      id: hostel._id,
      name: hostel.name,
      address: hostel.address,
      city: hostel.city,
      contactPhone: hostel.contactPhone,
    }));

    profile.subscriptionUsage = await getManagerUsage(user._id);
  } else {
    const tenancy = await Tenancy.findOne({
      resident: user._id,
      status: "active",
    })
      .populate("hostel", "name address city contactPhone")
      .populate("room", "roomNumber rent")
      .lean();

    if (tenancy) {
      profile.tenancyId = tenancy._id;
      profile.checkInDate = tenancy.checkInDate;
      profile.hostel = {
        id: tenancy.hostel._id,
        name: tenancy.hostel.name,
        address: tenancy.hostel.address,
        city: tenancy.hostel.city,
        contactPhone: tenancy.hostel.contactPhone,
      };
      profile.room = {
        id: tenancy.room._id,
        roomNumber: tenancy.room.roomNumber,
        rent:
          tenancy.monthlyRent != null && tenancy.monthlyRent >= 0
            ? tenancy.monthlyRent
            : tenancy.room.rent,
        defaultRent: tenancy.room.rent,
      };
    }
  }

  return profile;
};

const UPDATABLE_FIELDS = [
  "name",
  "email",
  "address",
  "dateOfBirth",
  "cnic",
  "profileImage",
];

export const getMe = asyncHandler(async (req, res) => {
  const profile = await buildProfile(req.user);
  return success(res, "Profile fetched successfully", { user: profile });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (phone && phone !== req.user.phone) {
    throw new AppError("Phone number cannot be changed", 400);
  }

  const hasUpdate = UPDATABLE_FIELDS.some((field) => req.body[field] !== undefined);
  if (!hasUpdate) {
    throw new AppError("Nothing to update", 400);
  }

  const user = await User.findById(req.user._id);

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.email !== undefined) {
    if (req.body.email === "" || req.body.email === null) {
      user.set("email", undefined);
    } else {
      user.email = req.body.email;
    }
  }
  if (req.body.address !== undefined) {
    user.address =
      req.body.address === "" || req.body.address === null ? null : req.body.address;
  }
  if (req.body.dateOfBirth !== undefined) {
    user.dateOfBirth =
      req.body.dateOfBirth === "" || req.body.dateOfBirth === null
        ? null
        : new Date(req.body.dateOfBirth);
  }
  if (req.body.cnic !== undefined) {
    user.cnic = req.body.cnic === "" || req.body.cnic === null ? null : req.body.cnic;
  }
  if (req.body.profileImage !== undefined) {
    user.profileImage =
      req.body.profileImage === "" || req.body.profileImage === null
        ? null
        : req.body.profileImage;
  }

  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.email) {
      throw new AppError("Email is already in use", 409);
    }
    throw err;
  }

  const profile = await buildProfile(user);
  return success(res, "Profile updated successfully", { user: profile });
});
