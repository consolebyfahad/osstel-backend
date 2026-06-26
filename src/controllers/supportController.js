import SupportRequest from "../models/SupportRequest.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { formatSupportRequest } from "../utils/supportHelpers.js";
import {
  assertHasFeature,
  assertResidentManagerFeature,
  PLAN_FEATURES,
} from "../utils/subscriptionHelpers.js";

export const submitSupportRequest = asyncHandler(async (req, res) => {
  if (req.user.role === "resident") {
    await assertResidentManagerFeature(req.user._id, PLAN_FEATURES.support);
  } else {
    assertHasFeature(req.user, PLAN_FEATURES.support);
  }
  const { subject, message, category } = req.body;

  const request = await SupportRequest.create({
    user: req.user._id,
    subject,
    message,
    category,
  });

  return success(
    res,
    "Support request submitted",
    { request: formatSupportRequest(request) },
    201
  );
});

export const getMySupportRequests = asyncHandler(async (req, res) => {
  if (req.user.role === "resident") {
    await assertResidentManagerFeature(req.user._id, PLAN_FEATURES.support);
  } else {
    assertHasFeature(req.user, PLAN_FEATURES.support);
  }
  const { page, limit, skip } = getPagination(req.query);

  const [requests, total] = await Promise.all([
    SupportRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupportRequest.countDocuments({ user: req.user._id }),
  ]);

  return success(res, "Support requests fetched successfully", {
    requests: requests.map(formatSupportRequest),
    pagination: buildPagination(total, page, limit),
  });
});

export const getMySupportRequestById = asyncHandler(async (req, res) => {
  if (req.user.role === "resident") {
    await assertResidentManagerFeature(req.user._id, PLAN_FEATURES.support);
  } else {
    assertHasFeature(req.user, PLAN_FEATURES.support);
  }
  const request = await SupportRequest.findOne({
    _id: req.params.id,
    user: req.user._id,
  }).lean();

  if (!request) throw new AppError("Support request not found", 404);

  return success(res, "Support request fetched successfully", {
    request: formatSupportRequest(request),
  });
});
