import AppError from "../utils/AppError.js";

export const notFound = (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern || {})[0];
    const messages = {
      phone: "Phone number already in use",
      email: "Email is already in use",
      userId: "User ID already in use",
    };
    message = messages[field] || "Duplicate field value";
    console.error("[Duplicate key]", field, err.keyValue);
  }

  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large. Image uploads must stay under 2MB each.";
  }

  const response = {
    success: false,
    message,
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  if (process.env.NODE_ENV === "development" && statusCode === 500 && !err.isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
