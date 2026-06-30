import mongoose from "mongoose";

const joinRequestSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    tenancy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

joinRequestSchema.index({ resident: 1, status: 1 });
joinRequestSchema.index({ hostel: 1, status: 1, createdAt: -1 });
joinRequestSchema.index(
  { resident: 1, hostel: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

export default mongoose.model("JoinRequest", joinRequestSchema);
