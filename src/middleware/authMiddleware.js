import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { clearExpiredTrialIfNeeded } from "../utils/trialHelpers.js";

export const protect = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Not authorized, no token", 401);
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (user.status === "blocked") {
      throw new AppError("Your account has been blocked. Contact support.", 403);
    }

    await clearExpiredTrialIfNeeded(user);

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Not authorized, invalid or expired token", 401);
  }
};

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError("Not authorized for this action", 403);
    }

    next();
  };
