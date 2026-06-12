import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ["manager", "resident"],
    },
    password: { type: String, required: true, minlength: 6 },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
