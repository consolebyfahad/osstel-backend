import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    details: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    expenseDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

expenseSchema.index({ hostel: 1, year: 1, month: 1, createdAt: -1 });
expenseSchema.index({ manager: 1, year: 1, month: 1 });

export default mongoose.model("Expense", expenseSchema);
