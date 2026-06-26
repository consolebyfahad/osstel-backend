import { normalizePlanId } from "../config/plans.js";
import User from "../models/User.js";
import { notifyUser } from "../services/pushNotificationService.js";
import {
  formatSubscriptionPeriodForClient,
  getEffectivePaidPlanId,
} from "./subscriptionLifecycleHelpers.js";

export const TRIAL_PLAN = "premium";
export const TRIAL_DURATIONS = [10, 20, 30];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addDays = (fromDate, days) =>
  new Date(fromDate.getTime() + days * MS_PER_DAY);

export const isTrialActive = (user) => {
  if (!user?.trialPlan || !user?.trialEndsAt) return false;
  return new Date(user.trialEndsAt) > new Date();
};

export const getEffectivePlanId = (user) => getEffectivePaidPlanId(user);

const revertTrialSubscription = (user) => {
  user.subscriptionPlan = normalizePlanId(user.baseSubscriptionPlan || "free");
  user.baseSubscriptionPlan = null;
  user.trialPlan = null;
  user.trialEndsAt = null;
  user.trialExpiryReminderSentAt = null;
};

export const grantProTrial = (user, days, now = new Date()) => {
  if (!isTrialActive(user)) {
    user.baseSubscriptionPlan = normalizePlanId(user.subscriptionPlan);
  }

  user.subscriptionPlan = TRIAL_PLAN;
  user.trialPlan = TRIAL_PLAN;
  user.trialEndsAt = addDays(now, days);
  user.trialExpiryReminderSentAt = null;
};

export const clearExpiredTrialIfNeeded = async (user) => {
  if (!user?.trialEndsAt || !user?.trialPlan) return false;
  if (new Date(user.trialEndsAt) > new Date()) return false;

  revertTrialSubscription(user);
  await user.save();
  return true;
};

export const cancelActiveTrial = (user) => {
  if (!user?.trialPlan || !user?.trialEndsAt) {
    return false;
  }

  revertTrialSubscription(user);
  return true;
};

export const formatTrialForClient = (user) => {
  if (!isTrialActive(user)) return null;

  const endsAt = new Date(user.trialEndsAt);
  const msLeft = endsAt.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    active: true,
    endsAt: endsAt.toISOString(),
    daysRemaining,
  };
};

export const formatSubscriptionForClient = (user) => ({
  subscriptionPlan: getEffectivePlanId(user),
  baseSubscriptionPlan: normalizePlanId(
    user.baseSubscriptionPlan ?? user.subscriptionPlan,
  ),
  trial: formatTrialForClient(user),
  subscription: formatSubscriptionPeriodForClient(user),
});

export const expireAllTrials = async () => {
  const now = new Date();
  const owners = await User.find({
    role: "manager",
    trialPlan: { $ne: null },
    trialEndsAt: { $lte: now },
  });

  let expired = 0;

  for (const owner of owners) {
    revertTrialSubscription(owner);
    await owner.save();

    void notifyUser(owner._id, {
      title: "Pro trial ended",
      body: "Your Pro trial has ended. Upgrade to keep premium features.",
      type: "trial_expired",
      data: { url: "/subscription" },
    });

    expired += 1;
  }

  return expired;
};

export const sendTrialExpiryReminders = async () => {
  const now = new Date();
  const reminderCutoff = addDays(now, 1);

  const owners = await User.find({
    role: "manager",
    trialPlan: TRIAL_PLAN,
    trialEndsAt: { $gt: now, $lte: reminderCutoff },
    trialExpiryReminderSentAt: null,
  });

  let sent = 0;

  for (const owner of owners) {
    const endsAt = new Date(owner.trialEndsAt);
    const daysRemaining = Math.max(
      0,
      Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );

    void notifyUser(owner._id, {
      title: "Pro trial ending soon",
      body: `Your Pro trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Upgrade to keep full access.`,
      type: "trial_expiring",
      data: { url: "/subscription" },
    });

    owner.trialExpiryReminderSentAt = now;
    await owner.save();
    sent += 1;
  }

  return sent;
};
