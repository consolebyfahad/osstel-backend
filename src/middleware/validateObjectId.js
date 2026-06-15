import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

export const validateObjectId = (paramName) => (req, _res, next) => {
  const id = req.params[paramName];

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${paramName}`, 400);
  }

  next();
};
