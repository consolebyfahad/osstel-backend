import { Router } from "express";
import { body } from "express-validator";
import {
  createExpense,
  getExpenses,
  getExpenseSummary,
} from "../controllers/expenseController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateImageDataUrl } from "../utils/validationHelpers.js";

const router = Router();

router.get("/summary", protect, authorize("manager"), getExpenseSummary);

router.get("/", protect, authorize("manager"), getExpenses);

router.post(
  "/",
  protect,
  authorize("manager"),
  [
    body("hostelId").notEmpty().withMessage("hostelId is required"),
    body("title").trim().notEmpty().withMessage("title is required"),
    body("details")
      .optional({ values: "null" })
      .trim()
      .isString()
      .withMessage("details must be a string"),
    body("amount")
      .notEmpty()
      .withMessage("amount is required")
      .isFloat({ min: 0 })
      .withMessage("amount must be a non-negative number"),
    body("image")
      .optional({ values: "null" })
      .custom((value) => validateImageDataUrl(value, "image")),
    body("month")
      .optional({ values: "null" })
      .isInt({ min: 1, max: 12 })
      .withMessage("month must be between 1 and 12"),
    body("year")
      .optional({ values: "null" })
      .isInt({ min: 2000 })
      .withMessage("year must be valid"),
  ],
  validate,
  createExpense,
);

export default router;
