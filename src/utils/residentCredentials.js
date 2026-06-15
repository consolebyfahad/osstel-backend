import User from "../models/User.js";

const PASSWORD_WORDS = [
  "apple",
  "river",
  "house",
  "blue",
  "moon",
  "star",
  "tree",
  "cloud",
  "happy",
  "light",
  "green",
  "stone",
  "water",
  "sunny",
  "peace",
  "sweet",
  "brave",
  "clear",
  "fresh",
  "quiet",
  "lucky",
  "smart",
  "quick",
  "solid",
  "warm",
  "cool",
  "bright",
  "calm",
  "neat",
  "safe",
];

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

export const generateSixWordPassword = () =>
  Array.from({ length: 6 }, () => randomItem(PASSWORD_WORDS)).join(" ");

const generateUserIdCandidate = () => {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `VAAS-${digits}`;
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
  `Welcome to VAAS${name ? `, ${name}` : ""}!\n\nYour login credentials:\nUser ID: ${userId}\nPassword: ${password}\n\nUse these to login to the resident app.`;
