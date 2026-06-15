import { Router } from "express";
import { body } from "express-validator";
import {
  getMySupportRequestById,
  getMySupportRequests,
  submitSupportRequest,
} from "../controllers/supportController.js";
import { protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.use(protect);

router.post(
  "/",
  [
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("message").trim().notEmpty().withMessage("Message is required"),
    body("category")
      .isIn(["billing", "technical", "account", "other"])
      .withMessage("Invalid category"),
  ],
  validate,
  submitSupportRequest
);

router.get("/", getMySupportRequests);
router.get("/:id", validateObjectId("id"), getMySupportRequestById);

export default router;
