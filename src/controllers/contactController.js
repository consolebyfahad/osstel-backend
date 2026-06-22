import ContactInquiry from "../models/ContactInquiry.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { formatContactInquiry } from "../utils/contactHelpers.js";

export const submitContactInquiry = asyncHandler(async (req, res) => {
  const { name, phone, email, message } = req.body;

  const inquiry = await ContactInquiry.create({
    name,
    phone,
    email,
    message,
    source: "website",
  });

  return success(
    res,
    "Your message has been sent. We will get back to you shortly.",
    { inquiry: formatContactInquiry(inquiry) },
    201
  );
});
