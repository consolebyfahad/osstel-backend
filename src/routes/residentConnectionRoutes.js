import { Router } from "express";
import { body } from "express-validator";
import {
  approveJoinRequest,
  approveLeaveRequest,
  createLeaveRequest,
  getManagerJoinRequests,
  getManagerLeaveRequests,
  joinHostel,
  rejectJoinRequest,
  rejectLeaveRequest,
} from "../controllers/connectionRequestController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { LIMITS } from "../config/limits.js";
import { trimmedTextValidator } from "../utils/fieldValidators.js";

const router = Router();

router.post(
  "/join-hostel",
  protect,
  authorize("resident"),
  [
    body("hostelCode")
      .trim()
      .notEmpty()
      .withMessage("Hostel code is required")
      .matches(/^OSS-[A-Z0-9]{4}$/)
      .withMessage("Enter a valid hostel code like OSS-A7K9"),
  ],
  validate,
  joinHostel,
);

router.post(
  "/leave-request",
  protect,
  authorize("resident"),
  [
    body("leavingDate")
      .notEmpty()
      .withMessage("Leaving date is required")
      .isISO8601()
      .withMessage("Valid leaving date is required"),
    trimmedTextValidator("reason", {
      max: LIMITS.NOTE_MAX,
      label: "Reason",
    }),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: LIMITS.MESSAGE_MAX })
      .withMessage(`Notes must be under ${LIMITS.MESSAGE_MAX} characters`),
    body("requestedRefundAmount")
      .optional({ values: "null" })
      .isFloat({ min: 0 })
      .withMessage("requestedRefundAmount must be a non-negative number"),
  ],
  validate,
  createLeaveRequest,
);

router.get(
  "/manager/join-requests",
  protect,
  authorize("manager"),
  getManagerJoinRequests,
);

router.put(
  "/manager/join-request/:id/approve",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  approveJoinRequest,
);

router.put(
  "/manager/join-request/:id/reject",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  rejectJoinRequest,
);

router.get(
  "/manager/leave-requests",
  protect,
  authorize("manager"),
  getManagerLeaveRequests,
);

router.put(
  "/manager/leave-request/:id/approve",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("refundAmount")
      .optional({ values: "null" })
      .isFloat({ min: 0 })
      .withMessage("refundAmount must be a non-negative number"),
  ],
  validate,
  approveLeaveRequest,
);

router.put(
  "/manager/leave-request/:id/reject",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  rejectLeaveRequest,
);

export default router;
