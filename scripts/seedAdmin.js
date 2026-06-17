import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

const userId = process.argv[2] || "fahad404";
const password = process.argv[3] || "admin6996";
const name = process.argv[4] || "Super Admin";
const phone = process.argv[5] || "03059111420";

await mongoose.connect(process.env.MONGO_URI);

const hashedPassword = await bcrypt.hash(password, 12);
let admin = await User.findOne({ role: "admin" });

if (admin) {
  admin.userId = userId;
  admin.password = hashedPassword;
  admin.name = name;
  await admin.save();
  console.log("Admin updated successfully");
} else {
  admin = await User.create({
    name,
    phone,
    userId,
    role: "admin",
    status: "active",
    subscriptionPlan: "premium",
    password: hashedPassword,
  });
  console.log("Admin created successfully");
}

console.log("User ID:", userId);
console.log("Password:", password);

await mongoose.disconnect();
