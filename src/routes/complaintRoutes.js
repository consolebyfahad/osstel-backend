import { Router } from "express";
import { body } from "express-validator";
import {
  createComplaint,
  getComplaints,
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
    body("hostelId").notEmpty().withMessage("hostelId is required"),
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("roomId").optional().isMongoId().withMessage("Invalid room ID"),
  ],
  validate,
  createComplaint
);

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
  updateComplaintStatus
);

export default router;
