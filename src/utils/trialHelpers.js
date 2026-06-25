import { normalizePlanId } from "../config/plans.js";
import User from "../models/User.js";
import {
  getEffectivePaidPlanId,
  isPaidSubscriptionActive,
} from "./subscriptionLifecycleHelpers.js";

export const TRIAL_PLAN = "premium";
export const TRIAL_DURATIONS = [10, 20, 30];

export const isTrialActive = (user) => {
  if (!user?.trialPlan || !user?.trialEndsAt) return false;
  return new Date(user.trialEndsAt) > new Date();
};

export const getEffectivePlanId = (user) => getEffectivePaidPlanId(user);

export const clearExpiredTrialIfNeeded = async (user) => {
  if (!user?.trialEndsAt || !user?.trialPlan) return false;
  if (new Date(user.trialEndsAt) > new Date()) return false;

  user.trialPlan = null;
  user.trialEndsAt = null;
  await user.save();
  return true;
};

export const formatTrialForClient = (user) => {
  if (!isTrialActive(user)) return null;

  const endsAt = new Date(user.trialEndsAt);
  const msLeft = endsAt.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    active: true,
    plan: normalizePlanId(user.trialPlan),
    endsAt: endsAt.toISOString(),
    daysRemaining,
  };
};

import {
  formatSubscriptionPeriodForClient,
} from "./subscriptionLifecycleHelpers.js";

export const formatSubscriptionForClient = (user) => ({
  subscriptionPlan: getEffectivePlanId(user),
  baseSubscriptionPlan: normalizePlanId(user.subscriptionPlan),
  trial: formatTrialForClient(user),
  subscription: formatSubscriptionPeriodForClient(user),
});

export const expireAllTrials = async () => {
  const result = await User.updateMany(
    {
      trialPlan: { $ne: null },
      trialEndsAt: { $lte: new Date() },
    },
    { $set: { trialPlan: null, trialEndsAt: null } }
  );

  return result.modifiedCount ?? 0;
};
