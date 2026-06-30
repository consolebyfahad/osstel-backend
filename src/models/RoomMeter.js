import mongoose from "mongoose";

const roomMeterSchema = new mongoose.Schema(
  {
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
    name: { type: String, required: true, trim: true },
    unitLabel: { type: String, required: true, trim: true, default: "unit" },
    ratePerUnit: { type: Number, required: true, min: 0 },
    lastReading: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roomMeterSchema.index({ room: 1, name: 1 }, { unique: true });

export default mongoose.model("RoomMeter", roomMeterSchema);
