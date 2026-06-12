import { Router } from "express";
import { body } from "express-validator";
import { login, register } from "../controllers/authController.js";

const router = Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone number is required"),
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
  register,
);

router.post(
  "/login",
  [
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isMobilePhone("any")
      .withMessage("Valid phone number is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login,
);

export default router;
