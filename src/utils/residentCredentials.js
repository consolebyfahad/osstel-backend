import crypto from "crypto";
import User from "../models/User.js";

const PASSWORD_LETTERS = "abcdefghijklmnopqrstuvwxyz";

export const generateResidentPassword = () => {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => PASSWORD_LETTERS[byte % PASSWORD_LETTERS.length]).join(
    "",
  );
};

const generateUserIdCandidate = () => {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return String(digits);
};

export const generateUniqueResidentUserId = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const userId = generateUserIdCandidate();
    const exists = await User.exists({ userId });
    if (!exists) return userId;
  }

  throw new Error("USER_ID_GENERATION_FAILED");
};

export const buildCredentialShareMessage = ({ name, userId, password }) =>
  `Welcome to OSSTEL${name ? `, ${name}` : ""}!\n\nYour login credentials:\nUser ID: ${userId}\nPassword: ${password}\n\nUse these to login to the resident app.`;
