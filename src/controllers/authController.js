import bcrypt from "bcryptjs";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  generateAuthTokens,
  revokeAllUserTokens,
  revokeRefreshToken,
  verifyRefreshToken,
} from "../services/tokenService.js";

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  phone: user.phone,
  userId: user.userId || null,
  role: user.role,
  status: user.status || "active",
  subscriptionPlan:
    user.subscriptionPlan === "basic"
      ? "standard"
      : user.subscriptionPlan || "free",
});

const findUserForLogin = async ({ phone, userId }) => {
  if (userId) {
    return User.findOne({ userId: userId.trim().toUpperCase() });
  }

  return User.findOne({ phone });
};

export const register = asyncHandler(async (req, res) => {
  const { name, phone, role, password } = req.body;

  if (role === "manager" && process.env.MANAGER_REGISTRATION_SECRET) {
    if (req.body.managerSecret !== process.env.MANAGER_REGISTRATION_SECRET) {
      throw new AppError("Invalid manager registration secret", 403);
    }
  }

  if (role === "admin") {
    throw new AppError("Admin accounts cannot be registered publicly", 403);
  }

  const existingUser = await User.findOne({ phone });

  if (existingUser) {
    throw new AppError("Phone number already in use", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    phone,
    role,
    password: hashedPassword,
  });

  const tokens = await generateAuthTokens(user);

  return success(
    res,
    "User registered successfully",
    { ...tokens, user: formatUser(user) },
    201,
  );
});

export const login = asyncHandler(async (req, res) => {
  const { phone, userId, password } = req.body;
  console.log(phone, userId, password);
  if (!phone && !userId) {
    throw new AppError("userId or phone is required", 400);
  }

  const user = await findUserForLogin({ phone, userId });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("Invalid credentials", 401);
  }

  if (user.status === "blocked") {
    throw new AppError("Your account has been blocked. Contact support.", 403);
  }

  await revokeAllUserTokens(user._id);
  const tokens = await generateAuthTokens(user);

  return success(res, "Login successful", {
    ...tokens,
    user: formatUser(user),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  const stored = await verifyRefreshToken(refreshToken);

  if (!stored?.user) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  await revokeRefreshToken(refreshToken);
  const tokens = await generateAuthTokens(stored.user);

  return success(res, "Token refreshed successfully", tokens);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  } else {
    await revokeAllUserTokens(req.user._id);
  }

  return success(res, "Logged out successfully");
});
