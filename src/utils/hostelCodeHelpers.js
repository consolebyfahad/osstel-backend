import crypto from "crypto";
import Hostel from "../models/Hostel.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodeSegment(length = 4) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join(
    "",
  );
}

export function formatHostelCode(segment) {
  return `OSS-${segment}`;
}

export async function generateUniqueHostelCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = formatHostelCode(randomCodeSegment(4));
    const exists = await Hostel.exists({ hostelCode: code });
    if (!exists) return code;
  }

  throw new Error("HOSTEL_CODE_GENERATION_FAILED");
}

export async function ensureHostelCode(hostel) {
  if (hostel.hostelCode) return hostel.hostelCode;

  const hostelCode = await generateUniqueHostelCode();
  hostel.hostelCode = hostelCode;
  await hostel.save();
  return hostelCode;
}
