import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";

const normalizePlan = (plan) => (plan === "basic" ? "standard" : plan);

const planRank = { free: 0, standard: 1, basic: 1, premium: 2 };

export const requestPlanUpgrade = asyncHandler(async (req, res) => {
  const { plan, note } = req.body;
  const currentPlan = normalizePlan(req.user.subscriptionPlan);

  if (planRank[plan] <= planRank[currentPlan]) {
    throw new AppError(
      `You are already on ${currentPlan} plan or higher`,
      400
    );
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
    currentPlan,
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
    currentPlan: normalizePlan(req.user.subscriptionPlan),
  });
});

export const getPlans = asyncHandler(async (_req, res) => {
  return success(res, "Plans fetched successfully", {
    plans: [
      {
        id: "free",
        name: "Free",
        price: 0,
        features: ["1 hostel", "Up to 10 rooms", "Basic dashboard"],
      },
      {
        id: "standard",
        name: "Standard",
        price: 2999,
        features: ["3 hostels", "Unlimited rooms", "Rent management", "Reports"],
      },
      {
        id: "premium",
        name: "Premium",
        price: 5999,
        features: [
          "Unlimited hostels",
          "Unlimited rooms",
          "Priority support",
          "Advanced analytics",
        ],
      },
    ],
  });
});
