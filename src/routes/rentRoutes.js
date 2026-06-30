import { Router } from "express";
import { body } from "express-validator";
import {
  approveRent,
  getMyRent,
  getMyRentHistory,
  getRentCollection,
  markRentPaid,
  rejectRent,
  sendRentAlert,
  submitRentPayment,
  submitRentForReview,
  updateRentStatus,
} from "../controllers/rentController.js";
import {
  finalizeRentBill,
  getRentBillPreview,
} from "../controllers/meterController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { validateImageDataUrl } from "../utils/validationHelpers.js";

const router = Router();

const paymentProofValidator = body("paymentProof")
  .notEmpty()
  .withMessage("paymentProof is required")
  .custom((value) => validateImageDataUrl(value, "paymentProof"));

const statusValidator = [
  body("status")
    .isIn(["paid", "approved", "rejected"])
    .withMessage("Status must be paid, approved, or rejected"),
  body("rejectionReason")
    .optional({ values: "null" })
    .trim()
    .isString()
    .isLength({ max: 300 })
    .withMessage("rejectionReason must be under 300 characters"),
];

router.get("/", protect, authorize("manager"), getRentCollection);
router.get("/me", protect, authorize("resident"), getMyRent);
router.get("/me/history", protect, authorize("resident"), getMyRentHistory);

router.get(
  "/:id/bill-preview",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  getRentBillPreview,
);

router.post(
  "/:id/finalize-bill",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("extraCharges")
      .optional()
      .isArray()
      .withMessage("extraCharges must be an array"),
    body("extraCharges.*.label")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("extra charge label is required"),
    body("extraCharges.*.amount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("extra charge amount must be non-negative"),
  ],
  validate,
  finalizeRentBill,
);

router.post(
  "/:id/payment",
  protect,
  authorize("resident"),
  validateObjectId("id"),
  [
    paymentProofValidator,
    body("note").optional({ values: "null" }).trim().isString().isLength({ max: 300 }),
  ],
  validate,
  submitRentPayment
);

router.patch(
  "/:id/status",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  statusValidator,
  validate,
  updateRentStatus
);

router.post(
  "/:id/submit",
  protect,
  authorize("resident"),
  validateObjectId("id"),
  [
    paymentProofValidator,
    body("note").optional({ values: "null" }).trim().isString().isLength({ max: 300 }),
  ],
  validate,
  submitRentForReview
);

router.patch(
  "/:id/approve",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  approveRent
);

router.patch(
  "/:id/reject",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("reason").optional().trim().isString().isLength({ max: 300 }),
    body("rejectionReason").optional().trim().isString().isLength({ max: 300 }),
  ],
  validate,
  rejectRent
);

router.patch(
  "/:id/mark-paid",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  markRentPaid
);

router.post(
  "/:id/alert",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("message")
      .optional({ values: "null" })
      .trim()
      .isString()
      .isLength({ max: 300 })
      .withMessage("message must be under 300 characters"),
  ],
  validate,
  sendRentAlert
);

export default router;
