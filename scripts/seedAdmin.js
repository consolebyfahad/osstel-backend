import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

const phone = process.argv[2] || "03009999999";
const password = process.argv[3] || "admin123";
const name = process.argv[4] || "Super Admin";

await mongoose.connect(process.env.MONGO_URI);

const existing = await User.findOne({ phone });

if (existing) {
  console.log("Admin already exists with this phone:", phone);
} else {
  const hashedPassword = await bcrypt.hash(password, 12);
  await User.create({
    name,
    phone,
    role: "admin",
    status: "active",
    subscriptionPlan: "premium",
    password: hashedPassword,
  });
  console.log("Admin created successfully");
  console.log("Phone:", phone);
  console.log("Password:", password);
}

await mongoose.disconnect();
