import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    roomNumber: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    rent: { type: Number, required: true, min: 0 },
    separateMeterBilling: { type: Boolean, default: false },
    freeUnits: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
  },
  { timestamps: true }
);

roomSchema.index({ hostel: 1, roomNumber: 1 }, { unique: true });

export default mongoose.model("Room", roomSchema);
