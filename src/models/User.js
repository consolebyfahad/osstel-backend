import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    userId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: { type: String, trim: true, default: null },
    dateOfBirth: { type: Date, default: null },
    cnic: { type: String, trim: true, default: null },
    profileImage: { type: String, default: null },
    cnicFront: { type: String, default: null },
    cnicBack: { type: String, default: null },
    emergencyNumber: { type: String, trim: true, default: null },
    fatherName: { type: String, trim: true, default: null },
    fatherPhone: { type: String, trim: true, default: null },
    role: {
      type: String,
      required: true,
      enum: ["admin", "manager", "resident"],
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "standard", "premium"],
      default: "free",
    },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ userId: 1 }, { unique: true, sparse: true });

export default mongoose.model("User", userSchema);
