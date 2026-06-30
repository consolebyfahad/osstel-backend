import mongoose from "mongoose";

const tenancySchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnic: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    profileImage: { type: String, default: null },
    cnicFront: { type: String, default: null },
    cnicBack: { type: String, default: null },
    emergencyNumber: { type: String, trim: true, default: null },
    fatherName: { type: String, trim: true, default: null },
    fatherPhone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null },
    dateOfBirth: { type: Date, default: null },
    registeredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    checkInDate: { type: Date, default: Date.now },
    checkOutDate: { type: Date, default: null },
    /** Agreed monthly rent for this resident; null falls back to room.rent */
    monthlyRent: { type: Number, min: 0, default: null },
    /** One-time security deposit collected at check-in */
    securityDeposit: { type: Number, min: 0, default: 0 },
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
