import { Router } from "express";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import contactRoutes from "./contactRoutes.js";
import complaintRoutes from "./complaintRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import hostelRoutes from "./hostelRoutes.js";
import planRoutes from "./planRoutes.js";
import rentRoutes from "./rentRoutes.js";
import residentConnectionRoutes from "./residentConnectionRoutes.js";
import residentRoutes from "./residentRoutes.js";
import supportRoutes from "./supportRoutes.js";
import userRoutes from "./userRoutes.js";
import notificationRoutes from "./notificationRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/notifications", notificationRoutes);
router.use("/hostels", hostelRoutes);
router.use("/expenses", expenseRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/rent", rentRoutes);
router.use("/residents", residentRoutes);
router.use("/resident", residentConnectionRoutes);
router.use("/complaints", complaintRoutes);
router.use("/contact", contactRoutes);
router.use("/support", supportRoutes);
router.use("/plans", planRoutes);
router.use("/admin", adminRoutes);

export default router;
