import mongoose from "mongoose";

const planUpgradeRequestSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentPlan: {
      type: String,
      enum: ["free", "standard", "premium"],
      required: true,
    },
    requestedPlan: {
      type: String,
      enum: ["standard", "premium"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    note: { type: String, trim: true, default: null },
    adminNote: { type: String, trim: true, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

planUpgradeRequestSchema.index({ owner: 1, status: 1 });
planUpgradeRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PlanUpgradeRequest", planUpgradeRequestSchema);
