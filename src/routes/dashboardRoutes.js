import { Router } from "express";
import { getDashboard, getRecentActivitiesFeed } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, authorize("manager"), getDashboard);
router.get("/activities", protect, authorize("manager"), getRecentActivitiesFeed);

export default router;
