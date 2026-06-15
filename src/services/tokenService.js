import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/RefreshToken.js";

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY_DAYS = 7;

export const generateAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );

export const generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({ user: userId, token, expiresAt });

  return token;
};

export const generateAuthTokens = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user._id);

  return { accessToken, refreshToken, token: accessToken };
};

export const verifyRefreshToken = async (token) => {
  const stored = await RefreshToken.findOne({ token }).populate("user");

  if (!stored || stored.expiresAt < new Date()) {
    return null;
  }

  return stored;
};

export const revokeRefreshToken = async (token) => {
  if (token) {
    await RefreshToken.deleteOne({ token });
  }
};

export const revokeAllUserTokens = async (userId) => {
  await RefreshToken.deleteMany({ user: userId });
};
