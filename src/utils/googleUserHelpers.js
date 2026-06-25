import crypto from "crypto";
import bcrypt from "bcryptjs";

export const isLegacyGooglePhone = (phone) =>
  typeof phone === "string" && phone.startsWith("google_");

export const buildRandomPasswordHash = async () => {
  const random = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(random, 12);
};
