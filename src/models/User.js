import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      trim: true,
    },
    userId: {
      type: String,
      trim: true,
      match: [/^[a-zA-Z0-9]{4,20}$/, "userId must be 4-20 alphanumeric characters"],
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
    trialPlan: {
      type: String,
      enum: ["standard", "premium", null],
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    planStartedAt: {
      type: Date,
      default: null,
    },
    planExpiresAt: {
      type: Date,
      default: null,
    },
    planExpiryReminderSentAt: {
      type: Date,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      trim: true,
    },
    password: { type: String, minlength: 6 },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $gt: "" } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } },
);
userSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $gt: "" } } },
);
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $gt: "" } } },
);

export default mongoose.model("User", userSchema);
