import { Router } from "express";
import { body } from "express-validator";
import {
  createComplaint,
  getComplaints,
  getMyComplaints,
  updateComplaintStatus,
} from "../controllers/complaintController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.post(
  "/",
  protect,
  authorize("resident"),
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 120 })
      .withMessage("Title must be under 120 characters"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required")
      .isLength({ max: 2000 })
      .withMessage("Description must be under 2000 characters"),
  ],
  validate,
  createComplaint,
);

router.get("/me", protect, authorize("resident"), getMyComplaints);

router.get("/", protect, authorize("manager"), getComplaints);

router.patch(
  "/:id/status",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("status")
      .isIn(["open", "in_progress", "resolved"])
      .withMessage("Invalid status"),
  ],
  validate,
  updateComplaintStatus,
);

export default router;
