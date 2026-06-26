import { normalizePlanId } from "../config/plans.js";
import User from "../models/User.js";
import { notifyUser } from "../services/pushNotificationService.js";
import { isTrialActive } from "./trialHelpers.js";

export const SUBSCRIPTION_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const addSubscriptionDays = (fromDate, days = SUBSCRIPTION_PERIOD_DAYS) =>
  new Date(fromDate.getTime() + days * MS_PER_DAY);

export const getSubscriptionDaysRemaining = (user, now = new Date()) => {
  if (!user?.planExpiresAt) return null;
  const expiresAt = new Date(user.planExpiresAt);
  if (expiresAt <= now) return 0;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY));
};

export const isPaidSubscriptionActive = (user, now = new Date()) => {
  const plan = normalizePlanId(user?.subscriptionPlan);
  if (plan === "free") return false;
  if (isTrialActive(user)) return false;
  if (!user?.planExpiresAt) return false;
  return new Date(user.planExpiresAt) > now;
};

export const canRenewSubscription = (user, now = new Date()) => {
  if (!isPaidSubscriptionActive(user, now)) return false;
  const daysRemaining = getSubscriptionDaysRemaining(user, now);
  return daysRemaining !== null && daysRemaining <= 1;
};

export const activatePaidSubscription = (
  user,
  plan,
  now = new Date(),
  days = SUBSCRIPTION_PERIOD_DAYS,
) => {
  user.subscriptionPlan = normalizePlanId(plan);
  user.baseSubscriptionPlan = null;
  user.planStartedAt = now;
  user.planExpiresAt = addSubscriptionDays(now, days);
  user.planExpiryReminderSentAt = null;
  user.trialPlan = null;
  user.trialEndsAt = null;
  user.trialExpiryReminderSentAt = null;
};

export const extendPaidSubscription = (
  user,
  now = new Date(),
  days = SUBSCRIPTION_PERIOD_DAYS,
) => {
  const currentExpiry =
    user.planExpiresAt && new Date(user.planExpiresAt) > now
      ? new Date(user.planExpiresAt)
      : now;

  user.planExpiresAt = addSubscriptionDays(currentExpiry, days);
  user.planExpiryReminderSentAt = null;

  if (!user.planStartedAt || normalizePlanId(user.subscriptionPlan) === "free") {
    user.planStartedAt = now;
  }

  if (normalizePlanId(user.subscriptionPlan) === "free") {
    user.subscriptionPlan = "premium";
  }
};

export const clearPaidSubscription = (user) => {
  user.subscriptionPlan = "free";
  user.baseSubscriptionPlan = null;
  user.planStartedAt = null;
  user.planExpiresAt = null;
  user.planExpiryReminderSentAt = null;
  user.trialPlan = null;
  user.trialEndsAt = null;
  user.trialExpiryReminderSentAt = null;
};

export const clearExpiredSubscriptionIfNeeded = async (user) => {
  if (normalizePlanId(user.subscriptionPlan) === "free") {
    return false;
  }

  if (isTrialActive(user)) {
    return false;
  }

  if (!user?.planExpiresAt) {
    clearPaidSubscription(user);
    await user.save();
    return true;
  }

  if (new Date(user.planExpiresAt) > new Date()) return false;

  clearPaidSubscription(user);
  await user.save();
  return true;
};

export const formatSubscriptionPeriodForClient = (user) => {
  if (!isPaidSubscriptionActive(user)) return null;

  const plan = normalizePlanId(user.subscriptionPlan);
  const startedAt = user.planStartedAt
    ? new Date(user.planStartedAt).toISOString()
    : null;

  if (!user?.planExpiresAt) {
    return {
      active: true,
      plan,
      startedAt,
      expiresAt: null,
      daysRemaining: null,
      canRenew: false,
    };
  }

  const expiresAt = new Date(user.planExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      active: true,
      plan,
      startedAt,
      expiresAt: null,
      daysRemaining: null,
      canRenew: false,
    };
  }

  const daysRemaining = getSubscriptionDaysRemaining(user);

  return {
    active: true,
    plan,
    startedAt,
    expiresAt: expiresAt.toISOString(),
    daysRemaining: daysRemaining ?? 0,
    canRenew: canRenewSubscription(user),
  };
};

export const sendSubscriptionExpiryReminders = async () => {
  const now = new Date();
  const reminderCutoff = addSubscriptionDays(now, 1);

  const owners = await User.find({
    role: "manager",
    subscriptionPlan: { $in: ["standard", "premium"] },
    planExpiresAt: { $gt: now, $lte: reminderCutoff },
    planExpiryReminderSentAt: null,
  });

  let sent = 0;

  for (const owner of owners) {
    const daysRemaining = getSubscriptionDaysRemaining(owner, now);
    await notifyUser(owner._id, {
      title: "Subscription ending soon",
      body: `Your ${normalizePlanId(owner.subscriptionPlan) === "premium" ? "Pro" : "Standard"} plan ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Submit a renewal request to keep access.`,
      type: "subscription_expiring",
      data: { url: "/subscription" },
    });

    owner.planExpiryReminderSentAt = now;
    await owner.save();
    sent += 1;
  }

  return sent;
};

export const expireAllSubscriptions = async () => {
  const now = new Date();

  const owners = await User.find({
    role: "manager",
    subscriptionPlan: { $ne: "free" },
    $or: [{ planExpiresAt: null }, { planExpiresAt: { $lte: now } }],
  });

  let expired = 0;

  for (const owner of owners) {
    if (isTrialActive(owner)) {
      continue;
    }

    const previousPlan = normalizePlanId(owner.subscriptionPlan);
    clearPaidSubscription(owner);
    await owner.save();

    await notifyUser(owner._id, {
      title: "Subscription ended",
      body: `Your ${previousPlan === "premium" ? "Pro" : "Standard"} plan has ended. Submit a new request to activate again.`,
      type: "subscription_expired",
      data: { url: "/subscription" },
    });

    expired += 1;
  }

  return expired;
};

export const getEffectivePaidPlanId = (user) => {
  if (isTrialActive(user)) {
    return normalizePlanId(user.subscriptionPlan);
  }

  if (isPaidSubscriptionActive(user)) {
    return normalizePlanId(user.subscriptionPlan);
  }

  return "free";
};
