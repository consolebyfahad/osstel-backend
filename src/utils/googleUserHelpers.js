import crypto from "crypto";
import bcrypt from "bcryptjs";

export const isLegacyGooglePhone = (phone) =>
  typeof phone === "string" && phone.startsWith("google_");

export const hasRealPhone = (phone) =>
  typeof phone === "string" && phone.trim().length > 0 && !isLegacyGooglePhone(phone);

export const buildRandomPasswordHash = async () => {
  const random = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(random, 12);
};

export const cleanupInvalidPhoneValues = async (UserModel) => {
  await UserModel.updateMany(
    {
      $or: [
        { phone: null },
        { phone: "" },
        { phone: { $regex: /^google_/ } },
      ],
    },
    { $unset: { phone: 1 } },
  );
};
