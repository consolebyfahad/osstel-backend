import { Router } from "express";
import { body } from "express-validator";
import {
  createHostel,
  deleteHostel,
  getHostelById,
  getHostels,
  getMyHostels,
  updateHostel,
} from "../controllers/hostelController.js";
import {
  createRoom,
  deleteRoom,
  getRooms,
  updateRoom,
} from "../controllers/roomController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.get("/", getHostels);
router.get("/me", protect, authorize("manager"), getMyHostels);

router.post(
  "/",
  protect,
  authorize("manager"),
  [
    body("name").trim().notEmpty().withMessage("Hostel name is required"),
    body("address").trim().notEmpty().withMessage("Address is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    body("contactPhone")
      .trim()
      .notEmpty()
      .withMessage("Contact phone is required")
      .matches(/^\+?[0-9]{10,15}$/)
      .withMessage("Valid contact phone is required"),
  ],
  validate,
  createHostel
);

router.get(
  "/:hostelId",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  getHostelById
);

router.patch(
  "/:hostelId",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("address").optional().trim().notEmpty().withMessage("Address cannot be empty"),
    body("city").optional().trim().notEmpty().withMessage("City cannot be empty"),
    body("contactPhone")
      .optional()
      .trim()
      .matches(/^\+?[0-9]{10,15}$/)
      .withMessage("Valid contact phone is required"),
  ],
  validate,
  updateHostel
);

router.delete(
  "/:hostelId",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  deleteHostel
);

router.post(
  "/:hostelId/rooms",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  [
    body("roomNumber").trim().notEmpty().withMessage("Room number is required"),
    body("capacity").isInt({ min: 1 }).withMessage("Capacity must be at least 1"),
    body("rent").isFloat({ min: 0 }).withMessage("Rent must be 0 or greater"),
  ],
  validate,
  createRoom
);

router.get(
  "/:hostelId/rooms",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  getRooms
);

router.patch(
  "/:hostelId/rooms/:roomId",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  validateObjectId("roomId"),
  [
    body("roomNumber")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Room number cannot be empty"),
    body("capacity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Capacity must be at least 1"),
    body("rent")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Rent must be 0 or greater"),
    body("status")
      .optional()
      .isIn(["available", "occupied", "maintenance"])
      .withMessage("Invalid room status"),
  ],
  validate,
  updateRoom
);

router.delete(
  "/:hostelId/rooms/:roomId",
  protect,
  authorize("manager"),
  validateObjectId("hostelId"),
  validateObjectId("roomId"),
  deleteRoom
);

export default router;
