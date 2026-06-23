import crypto from "crypto";
import bcrypt from "bcryptjs";

export const buildGooglePhone = (googleId) => `google_${googleId}`;

export const buildRandomPasswordHash = async () => {
  const random = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(random, 12);
};
