import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "review", "paid", "rejected"],
      default: "pending",
    },
    dueDate: { type: Date, required: true },
    paymentProof: { type: String, default: null },
    note: { type: String, trim: true, default: null },
    submittedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: { type: String, default: null },
    reminderSentForPeriod: { type: String, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ hostel: 1, month: 1, year: 1 });
paymentSchema.index({ resident: 1, room: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payment", paymentSchema);
