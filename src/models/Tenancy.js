import mongoose from "mongoose";

const tenancySchema = new mongoose.Schema(
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
    checkInDate: { type: Date, default: Date.now },
    checkOutDate: { type: Date, default: null },
    /** Agreed monthly rent for this resident; null falls back to room.rent */
    monthlyRent: { type: Number, min: 0, default: null },
    status: {
      type: String,
      enum: ["active", "moved_out"],
      default: "active",
    },
  },
  { timestamps: true }
);

tenancySchema.index({ hostel: 1, status: 1 });
tenancySchema.index({ resident: 1, status: 1 });
tenancySchema.index({ room: 1, status: 1 });

export default mongoose.model("Tenancy", tenancySchema);
