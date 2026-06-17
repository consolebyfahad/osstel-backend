import { Router } from "express";
import { body } from "express-validator";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import validate from "../middleware/validate.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    body("role")
      .trim()
      .notEmpty()
      .withMessage("Role is required")
      .isIn(["manager", "resident"])
      .withMessage("Role must be manager or resident"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
  ],
  validate,
  register,
);

router.post(
  "/login",
  authLimiter,
  [
    body("userId")
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9]{4,20}$/)
      .withMessage("Valid userId is required (4-20 alphanumeric characters)"),
    body("phone")
      .optional()
      .trim()
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    body("password").notEmpty().withMessage("Password is required"),
    body().custom((_value, { req }) => {
      if (!req.body.phone && !req.body.userId) {
        throw new Error("userId or phone is required");
      }
      return true;
    }),
  ],
  validate,
  login,
);

router.post(
  "/refresh",
  authLimiter,
  [body("refreshToken").notEmpty().withMessage("Refresh token is required")],
  validate,
  refresh,
);

router.post("/logout", protect, logout);

export default router;
