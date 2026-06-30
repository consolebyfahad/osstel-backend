import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import { phonesMatch } from "./phoneHelpers.js";
import { getManagerHostel } from "./hostelHelpers.js";

export { getManagerHostel };

export const findRoomInHostel = async (hostelId, roomNumber) => {
  return Room.findOne({ hostel: hostelId, roomNumber: roomNumber.trim() });
};

export const getActiveTenancyCount = async (roomId) => {
  return Tenancy.countDocuments({ room: roomId, status: "active" });
};

export const syncRoomStatus = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room) return;

  const activeCount = await getActiveTenancyCount(roomId);

  if (activeCount >= room.capacity) {
    room.status = "occupied";
  } else if (room.status !== "maintenance") {
    room.status = "available";
  }

  await room.save();
};

const residentProfileFromTenancy = (tenancy) => {
  const linked = tenancy.resident && typeof tenancy.resident === "object";

  return {
    name: linked ? tenancy.resident.name : tenancy.name,
    phone: linked ? tenancy.resident.phone : tenancy.phone,
    userId: linked ? tenancy.resident.userId || null : null,
    cnic: linked ? tenancy.resident.cnic : tenancy.cnic,
    profileImage: linked
      ? tenancy.resident.profileImage || null
      : tenancy.profileImage || null,
    cnicFront: linked
      ? tenancy.resident.cnicFront || null
      : tenancy.cnicFront || null,
    cnicBack: linked
      ? tenancy.resident.cnicBack || null
      : tenancy.cnicBack || null,
    emergencyNumber: linked
      ? tenancy.resident.emergencyNumber || null
      : tenancy.emergencyNumber || null,
    fatherName: linked
      ? tenancy.resident.fatherName || null
      : tenancy.fatherName || null,
    fatherPhone: linked
      ? tenancy.resident.fatherPhone || null
      : tenancy.fatherPhone || null,
    email: linked
      ? tenancy.resident.email || null
      : tenancy.email || null,
    dateOfBirth: linked
      ? tenancy.resident.dateOfBirth || null
      : tenancy.dateOfBirth || null,
    isLinked: Boolean(linked || tenancy.resident),
  };
};

export const formatResident = (tenancy) => {
  const profile = residentProfileFromTenancy(tenancy);

  return {
    id: profile.isLinked ? tenancy.resident._id : null,
    tenancyId: tenancy._id,
    name: profile.name,
    phone: profile.phone,
    userId: profile.userId,
    cnic: profile.cnic,
    profileImage: profile.profileImage,
    cnicFront: profile.cnicFront,
    cnicBack: profile.cnicBack,
    emergencyNumber: profile.emergencyNumber,
    fatherName: profile.fatherName,
    fatherPhone: profile.fatherPhone,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth
      ? new Date(profile.dateOfBirth).toISOString().slice(0, 10)
      : null,
    address: tenancy.address || null,
    roomNumber: tenancy.room.roomNumber,
    roomId: tenancy.room._id,
    roomRent: tenancy.room.rent ?? null,
    monthlyRent: tenancy.monthlyRent ?? null,
    securityDeposit: tenancy.securityDeposit ?? 0,
    hostelId: tenancy.hostel,
    checkInDate: tenancy.checkInDate,
    createdAt: tenancy.createdAt,
    status: tenancy.status,
    isLinked: profile.isLinked,
  };
};

const applyTenancyProfileFields = (tenancy, fields) => {
  const {
    name,
    phone,
    cnic,
    address,
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
    email,
    dateOfBirth,
  } = fields;

  if (name !== undefined) tenancy.name = name;
  if (phone !== undefined) tenancy.phone = phone;
  if (cnic !== undefined) tenancy.cnic = cnic;
  if (address !== undefined) {
    tenancy.address = address === "" || address === null ? null : address;
  }
  if (email !== undefined) {
    tenancy.email = email === "" || email === null ? null : email;
  }
  if (dateOfBirth !== undefined) {
    tenancy.dateOfBirth =
      dateOfBirth === "" || dateOfBirth === null
        ? null
        : new Date(dateOfBirth);
  }
  if (profileImage !== undefined) {
    tenancy.profileImage =
      profileImage === "" || profileImage === null ? null : profileImage;
  }
  if (cnicFront !== undefined) {
    tenancy.cnicFront =
      cnicFront === "" || cnicFront === null ? null : cnicFront;
  }
  if (cnicBack !== undefined) {
    tenancy.cnicBack = cnicBack === "" || cnicBack === null ? null : cnicBack;
  }
  if (emergencyNumber !== undefined) {
    tenancy.emergencyNumber =
      emergencyNumber === "" || emergencyNumber === null
        ? null
        : emergencyNumber;
  }
  if (fatherName !== undefined) {
    tenancy.fatherName =
      fatherName === "" || fatherName === null ? null : fatherName;
  }
  if (fatherPhone !== undefined) {
    tenancy.fatherPhone =
      fatherPhone === "" || fatherPhone === null ? null : fatherPhone;
  }
};

export const findUnlinkedTenancyByPhoneInHostel = async (hostelId, phone) => {
  const tenancies = await Tenancy.find({
    hostel: hostelId,
    status: "active",
    resident: null,
  }).lean();

  return tenancies.find((tenancy) => phonesMatch(tenancy.phone, phone)) ?? null;
};

export const findUnlinkedTenancyForUserInHostel = async (hostelId, user) => {
  const tenancies = await Tenancy.find({
    hostel: hostelId,
    status: "active",
    resident: null,
  }).lean();

  return (
    tenancies.find((tenancy) => {
      if (
        tenancy.registeredUser &&
        String(tenancy.registeredUser) === String(user._id)
      ) {
        return true;
      }
      return phonesMatch(tenancy.phone, user.phone);
    }) ?? null
  );
};

export const formatResidentLookup = async (user) => {
  const activeTenancy = await Tenancy.findOne({
    resident: user._id,
    status: "active",
  })
    .populate("hostel", "name")
    .lean();

  return {
    userId: user.userId,
    name: user.name,
    phone: user.phone,
    email: user.email || null,
    address: user.address || null,
    dateOfBirth: user.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
      : null,
    cnic: user.cnic || null,
    profileImage: user.profileImage || null,
    cnicFront: user.cnicFront || null,
    cnicBack: user.cnicBack || null,
    emergencyNumber: user.emergencyNumber || null,
    fatherName: user.fatherName || null,
    fatherPhone: user.fatherPhone || null,
    hostelConnectionStatus: user.hostelConnectionStatus || "not_connected",
    canLink: !activeTenancy,
    connectedHostelName: activeTenancy?.hostel?.name ?? null,
  };
};

export const findActiveTenancyByPhoneInHostel = async (hostelId, phone) => {
  const tenancies = await Tenancy.find({
    hostel: hostelId,
    status: "active",
  })
    .populate("resident", "phone")
    .lean();

  return (
    tenancies.find((tenancy) => {
      if (phonesMatch(tenancy.phone, phone)) return true;
      if (tenancy.resident?.phone && phonesMatch(tenancy.resident.phone, phone)) {
        return true;
      }
      return false;
    }) ?? null
  );
};

export const createHostelResidentRecord = async ({
  hostelId,
  roomId,
  name,
  phone,
  cnic,
  address,
  profileImage,
  cnicFront,
  cnicBack,
  emergencyNumber,
  fatherName,
  fatherPhone,
  email,
  dateOfBirth,
  monthlyRent,
  securityDeposit,
  checkInDate,
  residentUserId,
}) => {
  let registeredUser = null;

  if (residentUserId) {
    registeredUser = await User.findOne({
      userId: residentUserId.trim(),
      role: "resident",
    });

    if (!registeredUser) {
      throw new Error("RESIDENT_USER_NOT_FOUND");
    }

    if (!phonesMatch(registeredUser.phone, phone)) {
      throw new Error("PHONE_MISMATCH");
    }

    const linkedTenancy = await Tenancy.findOne({
      hostel: hostelId,
      resident: registeredUser._id,
      status: "active",
    });

    if (linkedTenancy) {
      throw new Error("RESIDENT_ALREADY_IN_HOSTEL");
    }

    const activeElsewhere = await Tenancy.findOne({
      resident: registeredUser._id,
      status: "active",
    });

    if (activeElsewhere) {
      throw new Error("RESIDENT_ALREADY_CONNECTED");
    }
  }

  const existingUser = await User.findOne({ phone });
  if (existingUser && existingUser.role !== "resident") {
    throw new Error("PHONE_IN_USE");
  }

  const existingTenancy = await findActiveTenancyByPhoneInHostel(hostelId, phone);
  if (existingTenancy) {
    throw new Error("RESIDENT_ALREADY_IN_HOSTEL");
  }

  return Tenancy.create({
    resident: null,
    registeredUser: registeredUser?._id ?? null,
    hostel: hostelId,
    room: roomId,
    name: name.trim(),
    phone: phone.trim(),
    cnic: cnic || null,
    address: address || null,
    email: email || null,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    profileImage: profileImage || null,
    cnicFront: cnicFront || null,
    cnicBack: cnicBack || null,
    emergencyNumber: emergencyNumber || null,
    fatherName: fatherName || null,
    fatherPhone: fatherPhone || null,
    checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
    status: "active",
    monthlyRent,
    securityDeposit,
  });
};

export const linkResidentToTenancy = async (user, tenancy) => {
  user.name = user.name || tenancy.name;
  user.cnic = user.cnic || tenancy.cnic;
  user.address = user.address || tenancy.address;
  user.profileImage = user.profileImage || tenancy.profileImage;
  user.cnicFront = user.cnicFront || tenancy.cnicFront;
  user.cnicBack = user.cnicBack || tenancy.cnicBack;
  user.emergencyNumber = user.emergencyNumber || tenancy.emergencyNumber;
  user.fatherName = user.fatherName || tenancy.fatherName;
  user.fatherPhone = user.fatherPhone || tenancy.fatherPhone;
  user.email = user.email || tenancy.email;
  user.dateOfBirth = user.dateOfBirth || tenancy.dateOfBirth;
  user.hostelConnectionStatus = "active";
  await user.save();

  tenancy.resident = user._id;
  await tenancy.save();

  await Payment.updateMany(
    { tenancy: tenancy._id },
    { $set: { resident: user._id } },
  );

  return tenancy;
};

export { applyTenancyProfileFields };
