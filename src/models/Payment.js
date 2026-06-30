import mongoose from "mongoose";

const rentChargeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["meter", "extra"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    units: { type: Number, min: 0, default: null },
    rate: { type: Number, min: 0, default: null },
    amount: { type: Number, required: true, min: 0 },
    meterReadingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeterReading",
      default: null,
    },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    tenancy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
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
    baseAmount: { type: Number, min: 0, default: null },
    charges: { type: [rentChargeSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    billFinalizedAt: { type: Date, default: null },
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
paymentSchema.index({ hostel: 1, status: 1, month: 1, year: 1 });
paymentSchema.index({ status: 1, month: 1, year: 1 });
paymentSchema.index(
  { tenancy: 1, month: 1, year: 1 },
  { unique: true, sparse: true },
);
paymentSchema.index(
  { resident: 1, room: 1, month: 1, year: 1 },
  { unique: true, sparse: true },
);

paymentSchema.pre("validate", function validatePaymentResidentOrTenancy() {
  if (!this.resident && !this.tenancy) {
    throw new Error("Payment requires either resident or tenancy");
  }
});

export default mongoose.model("Payment", paymentSchema);
