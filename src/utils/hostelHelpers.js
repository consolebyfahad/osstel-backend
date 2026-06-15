import Hostel from "../models/Hostel.js";
import AppError from "./AppError.js";

export const getManagerHostel = async (hostelId, managerId) => {
  return Hostel.findOne({ _id: hostelId, manager: managerId });
};

export const requireManagerHostel = async (hostelId, managerId) => {
  const hostel = await getManagerHostel(hostelId, managerId);

  if (!hostel) {
    throw new AppError("Hostel not found", 404);
  }

  return hostel;
};
