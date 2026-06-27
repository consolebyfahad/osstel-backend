import { body } from "express-validator";
import { LIMITS, passwordLengthMessage } from "../config/limits.js";

export const passwordValidator = (field = "password", { required = true } = {}) => {
  const chain = body(field).trim();
  if (required) {
    return chain
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: LIMITS.PASSWORD_MIN, max: LIMITS.PASSWORD_MAX })
      .withMessage(passwordLengthMessage);
  }
  return chain
    .optional()
    .isLength({ max: LIMITS.PASSWORD_MAX })
    .withMessage(passwordLengthMessage);
};

export const loginPasswordValidator = () =>
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: LIMITS.PASSWORD_MAX })
    .withMessage(passwordLengthMessage);

export const nameValidator = (field = "name", { required = true, max = LIMITS.NAME_MAX } = {}) => {
  const chain = body(field).trim();
  if (required) {
    return chain
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max })
      .withMessage(`Name must be under ${max} characters`);
  }
  return chain
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ max })
    .withMessage(`Name must be under ${max} characters`);
};

export const trimmedTextValidator = (
  field,
  {
    required = true,
    max,
    label = field,
  },
) => {
  const chain = body(field).trim();
  if (required) {
    return chain
      .notEmpty()
      .withMessage(`${label} is required`)
      .isLength({ max })
      .withMessage(`${label} must be under ${max} characters`);
  }
  return chain
    .optional()
    .trim()
    .notEmpty()
    .withMessage(`${label} cannot be empty`)
    .isLength({ max })
    .withMessage(`${label} must be under ${max} characters`);
};
