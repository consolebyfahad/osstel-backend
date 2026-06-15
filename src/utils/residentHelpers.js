import {
  buildCredentialShareMessage,
  generateSixWordPassword,
  generateUniqueResidentUserId,
} from "./residentCredentials.js";
import bcrypt from "bcryptjs";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
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

export const formatResident = (tenancy) => ({
  id: tenancy.resident._id,
  tenancyId: tenancy._id,
  name: tenancy.resident.name,
  phone: tenancy.resident.phone,
  userId: tenancy.resident.userId || null,
  cnic: tenancy.resident.cnic,
  profileImage: tenancy.resident.profileImage || null,
  cnicFront: tenancy.resident.cnicFront || null,
  cnicBack: tenancy.resident.cnicBack || null,
  emergencyNumber: tenancy.resident.emergencyNumber || null,
  fatherName: tenancy.resident.fatherName || null,
  fatherPhone: tenancy.resident.fatherPhone || null,
  roomNumber: tenancy.room.roomNumber,
  roomId: tenancy.room._id,
  hostelId: tenancy.hostel,
  checkInDate: tenancy.checkInDate,
  createdAt: tenancy.createdAt,
  status: tenancy.status,
});

const applyResidentProfileFields = (resident, fields) => {
  const {
    profileImage,
    cnicFront,
    cnicBack,
    emergencyNumber,
    fatherName,
    fatherPhone,
  } = fields;

  if (profileImage !== undefined) {
    resident.profileImage =
      profileImage === "" || profileImage === null ? null : profileImage;
  }
  if (cnicFront !== undefined) {
    resident.cnicFront = cnicFront === "" || cnicFront === null ? null : cnicFront;
  }
  if (cnicBack !== undefined) {
    resident.cnicBack = cnicBack === "" || cnicBack === null ? null : cnicBack;
  }
  if (emergencyNumber !== undefined) {
    resident.emergencyNumber =
      emergencyNumber === "" || emergencyNumber === null ? null : emergencyNumber;
  }
  if (fatherName !== undefined) {
    resident.fatherName =
      fatherName === "" || fatherName === null ? null : fatherName;
  }
  if (fatherPhone !== undefined) {
    resident.fatherPhone =
      fatherPhone === "" || fatherPhone === null ? null : fatherPhone;
  }
};

export const findOrCreateResident = async ({
  name,
  phone,
  cnic,
  profileImage,
  cnicFront,
  cnicBack,
  emergencyNumber,
  fatherName,
  fatherPhone,
}) => {
  let resident = await User.findOne({ phone });
  let loginCredentials = null;

  if (resident) {
    if (resident.role !== "resident") {
      throw new Error("PHONE_IN_USE");
    }

    resident.name = name;
    resident.cnic = cnic;
    applyResidentProfileFields(resident, {
      profileImage,
      cnicFront,
      cnicBack,
      emergencyNumber,
      fatherName,
      fatherPhone,
    });
    await resident.save();
    return { resident, loginCredentials };
  }

  const plainPassword = generateSixWordPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);
  const userId = await generateUniqueResidentUserId();

  resident = await User.create({
    name,
    phone,
    userId,
    cnic,
    role: "resident",
    password: hashedPassword,
    profileImage: profileImage || null,
    cnicFront: cnicFront || null,
    cnicBack: cnicBack || null,
    emergencyNumber: emergencyNumber || null,
    fatherName: fatherName || null,
    fatherPhone: fatherPhone || null,
  });

  loginCredentials = {
    userId,
    password: plainPassword,
    shareMessage: buildCredentialShareMessage({
      name,
      userId,
      password: plainPassword,
    }),
  };

  return { resident, loginCredentials };
};
