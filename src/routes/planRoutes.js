import { Router } from "express";
import { body } from "express-validator";
import {
  getMyPlanRequest,
  getPlans,
  requestPlanUpgrade,
} from "../controllers/planController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";

const router = Router();

router.get("/", getPlans);

router.get("/request", protect, authorize("manager"), getMyPlanRequest);

router.post(
  "/request",
  protect,
  authorize("manager"),
  [
    body("plan")
      .isIn(["standard", "premium"])
      .withMessage("Plan must be standard or premium"),
    body("note").optional().trim().isString().isLength({ max: 300 }),
  ],
  validate,
  requestPlanUpgrade
);

export default router;
