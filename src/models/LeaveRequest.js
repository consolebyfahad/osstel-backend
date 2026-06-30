import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
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
    leavingDate: { type: Date, required: true },
    reason: { type: String, trim: true, required: true },
    notes: { type: String, trim: true, default: null },
    securityDepositHeld: { type: Number, min: 0, default: 0 },
    requestedRefundAmount: { type: Number, min: 0, default: null },
    approvedRefundAmount: { type: Number, min: 0, default: null },
    refundExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
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

leaveRequestSchema.index({ resident: 1, status: 1 });
leaveRequestSchema.index({ hostel: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index(
  { resident: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

export default mongoose.model("LeaveRequest", leaveRequestSchema);
