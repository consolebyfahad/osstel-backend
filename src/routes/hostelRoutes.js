import { Router } from "express";
import { body } from "express-validator";
import {
  createHostel,
  deleteHostel,
  discoverHostels,
  getHostelById,
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
import { LIMITS } from "../config/limits.js";
import { nameValidator, trimmedTextValidator } from "../utils/fieldValidators.js";

const router = Router();

router.get(
  "/discover",
  protect,
  authorize("resident"),
  discoverHostels,
);

router.get("/", protect, authorize("manager"), getMyHostels);
router.get("/me", protect, authorize("manager"), getMyHostels);

router.post(
  "/",
  protect,
  authorize("manager"),
  [
    nameValidator("name", { max: LIMITS.HOSTEL_NAME_MAX }),
    trimmedTextValidator("address", {
      max: LIMITS.ADDRESS_MAX,
      label: "Address",
    }),
    body("city")
      .trim()
      .notEmpty()
      .withMessage("City is required")
      .isIn(LIMITS.ADD_HOSTEL_CITIES)
      .withMessage("City must be Lahore, Islamabad, Faisalabad, or Multan"),
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
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty")
      .isLength({ max: LIMITS.HOSTEL_NAME_MAX })
      .withMessage(`Name must be under ${LIMITS.HOSTEL_NAME_MAX} characters`),
    body("address")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Address cannot be empty")
      .isLength({ max: LIMITS.ADDRESS_MAX })
      .withMessage(`Address must be under ${LIMITS.ADDRESS_MAX} characters`),
    body("city")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("City cannot be empty")
      .isLength({ max: LIMITS.CITY_MAX })
      .withMessage(`City must be under ${LIMITS.CITY_MAX} characters`),
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
    body("roomNumber")
      .trim()
      .notEmpty()
      .withMessage("Room number is required")
      .isLength({ max: LIMITS.ROOM_NUMBER_MAX })
      .withMessage(`Room number must be under ${LIMITS.ROOM_NUMBER_MAX} characters`),
    body("capacity")
      .isInt({ min: LIMITS.ROOM_CAPACITY_MIN, max: LIMITS.ROOM_CAPACITY_MAX })
      .withMessage(
        `Capacity must be between ${LIMITS.ROOM_CAPACITY_MIN} and ${LIMITS.ROOM_CAPACITY_MAX}`,
      ),
    body("rent")
      .isFloat({ min: 0, max: LIMITS.RENT_MAX })
      .withMessage(`Rent must be between 0 and ${LIMITS.RENT_MAX}`),
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
      .withMessage("Room number cannot be empty")
      .isLength({ max: LIMITS.ROOM_NUMBER_MAX })
      .withMessage(`Room number must be under ${LIMITS.ROOM_NUMBER_MAX} characters`),
    body("capacity")
      .optional()
      .isInt({ min: LIMITS.ROOM_CAPACITY_MIN, max: LIMITS.ROOM_CAPACITY_MAX })
      .withMessage(
        `Capacity must be between ${LIMITS.ROOM_CAPACITY_MIN} and ${LIMITS.ROOM_CAPACITY_MAX}`,
      ),
    body("rent")
      .optional()
      .isFloat({ min: 0, max: LIMITS.RENT_MAX })
      .withMessage(`Rent must be between 0 and ${LIMITS.RENT_MAX}`),
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
