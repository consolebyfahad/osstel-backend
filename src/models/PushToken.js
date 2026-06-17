import mongoose from "mongoose";

const pushTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, trim: true },
    provider: {
      type: String,
      enum: ["fcm", "expo"],
      default: "fcm",
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
      required: true,
    },
    deviceId: { type: String, trim: true, default: null },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

pushTokenSchema.index({ token: 1 }, { unique: true });
pushTokenSchema.index({ user: 1, deviceId: 1 });

export default mongoose.model("PushToken", pushTokenSchema);
