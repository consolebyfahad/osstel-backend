import { Router } from "express";
import { body } from "express-validator";
import {
  googleAuth,
  login,
  logout,
  refresh,
  register,
} from "../controllers/authController.js";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import validate from "../middleware/validate.js";
import { LIMITS } from "../config/limits.js";
import {
  loginPasswordValidator,
  nameValidator,
  passwordValidator,
} from "../utils/fieldValidators.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  [
    nameValidator("name"),
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
    passwordValidator("password"),
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
      .withMessage(
        `Valid userId is required (${LIMITS.USER_ID_MIN}-${LIMITS.USER_ID_MAX} alphanumeric characters)`,
      ),
    body("phone")
      .optional()
      .trim()
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    loginPasswordValidator(),
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
  "/google",
  authLimiter,
  [body("idToken").trim().notEmpty().withMessage("Google ID token is required")],
  validate,
  googleAuth,
);

router.post(
  "/refresh",
  authLimiter,
  [body("refreshToken").notEmpty().withMessage("Refresh token is required")],
  validate,
  refresh,
);

router.post("/logout", optionalProtect, logout);

router.post(
  "/resident/signup",
  authLimiter,
  [
    nameValidator("name"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    passwordValidator("password"),
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
  (req, res, next) => {
    req.body.role = "resident";
    return register(req, res, next);
  },
);

router.post(
  "/resident/login",
  authLimiter,
  [
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone is required"),
    loginPasswordValidator(),
  ],
  validate,
  login,
);

export default router;
