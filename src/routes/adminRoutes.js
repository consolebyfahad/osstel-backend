import { Router } from "express";
import { body } from "express-validator";
import {
  approvePlanRequest,
  getAdminHostelById,
  getAdminHostels,
  getAdminStats,
  getOwnerById,
  getOwners,
  getPlanRequests,
  getSupportRequestById,
  getSupportRequests,
  rejectPlanRequest,
  replyToSupportRequest,
  toggleOwnerBlock,
  updateOwnerPlan,
  updateSupportRequestStatus,
} from "../controllers/adminController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getAdminStats);

router.get("/owners", getOwners);
router.get("/owners/:id", validateObjectId("id"), getOwnerById);
router.patch(
  "/owners/:id/block",
  validateObjectId("id"),
  [body("blocked").isBoolean().withMessage("blocked must be true or false")],
  validate,
  toggleOwnerBlock
);
router.patch(
  "/owners/:id/plan",
  validateObjectId("id"),
  [
    body("plan")
      .isIn(["free", "standard", "premium"])
      .withMessage("Plan must be free, standard, or premium"),
  ],
  validate,
  updateOwnerPlan
);

router.get("/hostels", getAdminHostels);
router.get("/hostels/:id", validateObjectId("id"), getAdminHostelById);

router.get("/plan-requests", getPlanRequests);
router.patch(
  "/plan-requests/:id/approve",
  validateObjectId("id"),
  [body("adminNote").optional().trim().isString()],
  validate,
  approvePlanRequest
);
router.patch(
  "/plan-requests/:id/reject",
  validateObjectId("id"),
  [body("adminNote").optional().trim().isString()],
  validate,
  rejectPlanRequest
);

router.get("/support-requests", getSupportRequests);
router.get("/support-requests/:id", validateObjectId("id"), getSupportRequestById);
router.patch(
  "/support-requests/:id/reply",
  validateObjectId("id"),
  [
    body("adminReply").trim().notEmpty().withMessage("adminReply is required"),
    body("status")
      .optional()
      .isIn(["in_progress", "resolved", "closed"])
      .withMessage("Invalid status"),
  ],
  validate,
  replyToSupportRequest
);
router.patch(
  "/support-requests/:id/status",
  validateObjectId("id"),
  [
    body("status")
      .isIn(["open", "in_progress", "resolved", "closed"])
      .withMessage("Invalid status"),
  ],
  validate,
  updateSupportRequestStatus
);

export default router;
