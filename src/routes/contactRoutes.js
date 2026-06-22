import { Router } from "express";
import { body } from "express-validator";
import { submitContactInquiry } from "../controllers/contactController.js";
import { contactLimiter } from "../middleware/rateLimiter.js";
import validate from "../middleware/validate.js";

const router = Router();

router.post(
  "/",
  contactLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("message").trim().notEmpty().withMessage("Message is required"),
  ],
  validate,
  submitContactInquiry
);

export default router;
