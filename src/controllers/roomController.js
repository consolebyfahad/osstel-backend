import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { requireManagerHostel } from "../utils/hostelHelpers.js";
import { getActiveTenancyCount, syncRoomStatus } from "../utils/residentHelpers.js";

export const createRoom = asyncHandler(async (req, res) => {
  const { hostelId } = req.params;
  const { roomNumber, capacity, rent } = req.body;

  const hostel = await requireManagerHostel(hostelId, req.user._id);

  try {
    const room = await Room.create({
      hostel: hostel._id,
      roomNumber,
      capacity,
      rent,
    });

    return success(res, "Room created successfully", { room }, 201);
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Room number already exists in this hostel", 400);
    }
    throw error;
  }
});

export const getRooms = asyncHandler(async (req, res) => {
  const { hostelId } = req.params;

  const hostel = await requireManagerHostel(hostelId, req.user._id);

  const rooms = await Room.find({ hostel: hostel._id })
    .sort({ roomNumber: 1 })
    .lean();

  return success(res, "Rooms fetched successfully", { rooms });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const { hostelId, roomId } = req.params;
  const { roomNumber, capacity, rent, status } = req.body;

  await requireManagerHostel(hostelId, req.user._id);

  const room = await Room.findOne({ _id: roomId, hostel: hostelId });

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  if (capacity !== undefined) {
    const activeCount = await getActiveTenancyCount(room._id);
    if (capacity < activeCount) {
      throw new AppError(
        `Capacity cannot be less than active residents (${activeCount})`,
        400
      );
    }
    room.capacity = capacity;
  }

  if (roomNumber) room.roomNumber = roomNumber;
  if (rent !== undefined) room.rent = rent;
  if (status) room.status = status;

  try {
    await room.save();
    await syncRoomStatus(room._id);
    return success(res, "Room updated successfully", { room });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("Room number already exists in this hostel", 400);
    }
    throw error;
  }
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const { hostelId, roomId } = req.params;

  await requireManagerHostel(hostelId, req.user._id);

  const room = await Room.findOne({ _id: roomId, hostel: hostelId });

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  const activeResidents = await Tenancy.countDocuments({
    room: room._id,
    status: "active",
  });

  if (activeResidents > 0) {
    throw new AppError(
      "Cannot delete room with active residents. Remove residents first.",
      400
    );
  }

  await room.deleteOne();

  return success(res, "Room deleted successfully");
});
