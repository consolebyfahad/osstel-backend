import { Router } from "express";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import complaintRoutes from "./complaintRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import hostelRoutes from "./hostelRoutes.js";
import planRoutes from "./planRoutes.js";
import rentRoutes from "./rentRoutes.js";
import residentRoutes from "./residentRoutes.js";
import supportRoutes from "./supportRoutes.js";
import userRoutes from "./userRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/hostels", hostelRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/rent", rentRoutes);
router.use("/residents", residentRoutes);
router.use("/complaints", complaintRoutes);
router.use("/support", supportRoutes);
router.use("/plans", planRoutes);
router.use("/admin", adminRoutes);

export default router;
