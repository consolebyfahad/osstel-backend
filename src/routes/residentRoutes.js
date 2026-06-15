import { Router } from "express";
import { body } from "express-validator";
import {
  addResident,
  getResidents,
  removeResident,
  updateResident,
} from "../controllers/residentController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { validateImageDataUrl } from "../utils/validationHelpers.js";

const router = Router();

const phoneValidator = (field, required = false) => {
  const chain = body(field).trim();
  if (required) {
    return chain
      .notEmpty()
      .withMessage(`${field} is required`)
      .matches(/^\+?[0-9]{10,15}$/)
      .withMessage(`Valid ${field} is required`);
  }
  return chain
    .optional({ values: "null" })
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage(`Valid ${field} is required`);
};

const imageValidator = (field) =>
  body(field)
    .optional({ values: "null" })
    .custom((value) => validateImageDataUrl(value, field));

const residentProfileValidators = [
  imageValidator("profileImage"),
  imageValidator("cnicFront"),
  imageValidator("cnicBack"),
  phoneValidator("emergencyNumber"),
  body("fatherName")
    .optional({ values: "null" })
    .trim()
    .isString()
    .withMessage("fatherName must be a string"),
  phoneValidator("fatherPhone"),
];

router.get("/", protect, authorize("manager"), getResidents);

router.post(
  "/",
  protect,
  authorize("manager"),
  [
    body("hostelId").notEmpty().withMessage("hostelId is required"),
    body("name").trim().notEmpty().withMessage("Name is required"),
    phoneValidator("phone", true),
    body("cnic")
      .trim()
      .notEmpty()
      .withMessage("CNIC is required")
      .matches(/^[0-9]{5}-[0-9]{7}-[0-9]$/)
      .withMessage("CNIC must be in format 12345-1234567-1"),
    body("roomNumber").trim().notEmpty().withMessage("Room number is required"),
    ...residentProfileValidators,
  ],
  validate,
  addResident
);

router.put(
  "/:id",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    phoneValidator("phone"),
    body("cnic")
      .optional()
      .trim()
      .matches(/^[0-9]{5}-[0-9]{7}-[0-9]$/)
      .withMessage("CNIC must be in format 12345-1234567-1"),
    body("roomNumber")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Room number cannot be empty"),
    ...residentProfileValidators,
  ],
  validate,
  updateResident
);

router.delete(
  "/:id",
  protect,
  authorize("manager"),
  validateObjectId("id"),
  removeResident
);

export default router;
