import { Router } from "express";
import { body } from "express-validator";
import { getMe, updateMe } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateImageDataUrl } from "../utils/validationHelpers.js";

const router = Router();

router.get("/me", protect, getMe);

router.patch(
  "/me",
  protect,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("phone").optional().trim(),
    body("email")
      .optional({ values: "null" })
      .trim()
      .custom((value) => {
        if (value === "" || value === null) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error("Valid email is required");
        }
        return true;
      }),
    body("address")
      .optional({ values: "null" })
      .trim()
      .isString()
      .withMessage("Address must be a string"),
    body("dateOfBirth")
      .optional({ values: "null" })
      .custom((value) => {
        if (value === "" || value === null) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error("dateOfBirth must be in YYYY-MM-DD format");
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error("Invalid dateOfBirth");
        }
        return true;
      }),
    body("cnic")
      .optional({ values: "null" })
      .trim()
      .custom((value) => {
        if (value === "" || value === null) return true;
        if (!/^[0-9]{5}-[0-9]{7}-[0-9]$/.test(value)) {
          throw new Error("CNIC must be in format 12345-1234567-1");
        }
        return true;
      }),
    body("profileImage")
      .optional({ values: "null" })
      .custom((value) => validateImageDataUrl(value, "profileImage")),
  ],
  validate,
  updateMe
);

export default router;
