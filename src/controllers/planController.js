import { getPlansCatalog } from "../config/plans.js";
import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getEffectivePlanId } from "../utils/trialHelpers.js";
import {
  canRenewSubscription,
  isPaidSubscriptionActive,
  formatSubscriptionPeriodForClient,
} from "../utils/subscriptionLifecycleHelpers.js";

const normalizePlan = (plan) => (plan === "basic" ? "standard" : plan);

const planRank = { free: 0, standard: 1, basic: 1, premium: 2 };

export const requestPlanUpgrade = asyncHandler(async (req, res) => {
  const { plan, note } = req.body;
  const currentPlan = getEffectivePlanId(req.user);
  const renewing = canRenewSubscription(req.user);
  const requestedPlan = normalizePlan(plan);

  if (!renewing && planRank[requestedPlan] <= planRank[currentPlan]) {
    throw new AppError(
      `You are already on ${currentPlan} plan or higher`,
      400
    );
  }

  if (
    renewing &&
    planRank[requestedPlan] < planRank[normalizePlanId(req.user.subscriptionPlan)]
  ) {
    throw new AppError("Renewal must be for your current plan or higher", 400);
  }

  const existing = await PlanUpgradeRequest.findOne({
    owner: req.user._id,
    status: "pending",
  });

  if (existing) {
    throw new AppError("You already have a pending plan request", 400);
  }

  const request = await PlanUpgradeRequest.create({
    owner: req.user._id,
    currentPlan: renewing
      ? normalizePlanId(req.user.subscriptionPlan)
      : currentPlan,
    requestedPlan: plan,
    note: note || null,
  });

  return success(
    res,
    "Plan upgrade request submitted successfully",
    {
      request: {
        id: request._id,
        currentPlan: request.currentPlan,
        requestedPlan: request.requestedPlan,
        status: request.status,
        createdAt: request.createdAt,
      },
    },
    201
  );
});

export const getMyPlanRequest = asyncHandler(async (req, res) => {
  const request = await PlanUpgradeRequest.findOne({
    owner: req.user._id,
    status: "pending",
  }).lean();

  return success(res, "Plan request fetched successfully", {
    request: request
      ? {
          id: request._id,
          currentPlan: normalizePlan(request.currentPlan),
          requestedPlan: request.requestedPlan,
          status: request.status,
          note: request.note,
          createdAt: request.createdAt,
        }
      : null,
    currentPlan: getEffectivePlanId(req.user),
    canRenew: canRenewSubscription(req.user),
    subscription: formatSubscriptionPeriodForClient(req.user),
  });
});

export const getPlans = asyncHandler(async (_req, res) => {
  return success(res, "Plans fetched successfully", {
    plans: getPlansCatalog(),
  });
});
