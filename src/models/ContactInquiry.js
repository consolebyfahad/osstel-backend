import mongoose from "mongoose";

const contactInquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ["website"],
      default: "website",
    },
    status: {
      type: String,
      enum: ["new", "in_progress", "replied", "closed"],
      default: "new",
    },
    adminReply: { type: String, trim: true, default: null },
    repliedAt: { type: Date, default: null },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

contactInquirySchema.index({ status: 1, createdAt: -1 });
contactInquirySchema.index({ email: 1, createdAt: -1 });
contactInquirySchema.index({ name: "text", email: "text", message: "text" });

export default mongoose.model("ContactInquiry", contactInquirySchema);
