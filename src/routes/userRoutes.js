import { Router } from "express";
import { body } from "express-validator";
import { getMe, updateMe, changePassword } from "../controllers/userController.js";
import {
  registerMyPushToken,
  removeMyPushToken,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateImageDataUrl } from "../utils/validationHelpers.js";
import { LIMITS } from "../config/limits.js";
import { nameValidator, passwordValidator } from "../utils/fieldValidators.js";

const router = Router();

router.get("/me", protect, getMe);

router.patch(
  "/me",
  protect,
  [
    nameValidator("name", { required: false, max: LIMITS.NAME_MAX }),
    body("phone").optional().trim(),
    body("email")
      .optional({ values: "null" })
      .trim()
      .isLength({ max: LIMITS.EMAIL_MAX })
      .withMessage(`Email must be under ${LIMITS.EMAIL_MAX} characters`)
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
      .isLength({ max: LIMITS.ADDRESS_MAX })
      .withMessage(`Address must be under ${LIMITS.ADDRESS_MAX} characters`),
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

router.patch(
  "/me/password",
  protect,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required")
      .isLength({ max: LIMITS.PASSWORD_MAX })
      .withMessage(`Current password must be under ${LIMITS.PASSWORD_MAX} characters`),
    passwordValidator("newPassword"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ],
  validate,
  changePassword,
);

router.put(
  "/me/push-token",
  protect,
  [
    body("token").trim().notEmpty().withMessage("token is required"),
    body("platform")
      .isIn(["ios", "android", "web"])
      .withMessage("platform must be ios, android, or web"),
    body("provider")
      .optional()
      .isIn(["fcm", "expo"])
      .withMessage("provider must be fcm or expo"),
    body("deviceId").optional({ values: "null" }).isString(),
  ],
  validate,
  registerMyPushToken,
);

router.delete(
  "/me/push-token",
  protect,
  [body("token").optional({ values: "null" }).isString()],
  validate,
  removeMyPushToken,
);

export default router;
