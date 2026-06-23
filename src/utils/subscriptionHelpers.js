import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import AppError from "./AppError.js";
import {
  getPlanConfig,
  getUpgradePlanLabel,
  normalizePlanId,
  PLAN_FEATURES,
} from "../config/plans.js";

export { PLAN_FEATURES };

export const getManagerUsage = async (managerId) => {
  const hostels = await Hostel.find({ manager: managerId }).select("_id").lean();
  const hostelIds = hostels.map((hostel) => hostel._id);

  if (!hostelIds.length) {
    return { hostels: 0, rooms: 0, tenants: 0 };
  }

  const [rooms, tenants] = await Promise.all([
    Room.countDocuments({ hostel: { $in: hostelIds } }),
    Tenancy.countDocuments({
      hostel: { $in: hostelIds },
      status: "active",
    }),
  ]);

  return {
    hostels: hostels.length,
    rooms,
    tenants,
  };
};

const buildLimitMessage = (resource, planId, limit) => {
  const upgradePlan = getUpgradePlanLabel(planId);
  const plan = getPlanConfig(planId);

  const labels = {
    hostel: "hostel",
    room: "room",
    tenant: "tenant",
  };

  const label = labels[resource] ?? resource;

  return `You have reached the maximum ${label} limit for the ${plan.name} plan (${limit}). Upgrade to ${upgradePlan} to add more ${label}s.`;
};

export const canAddHostel = (planId, currentHostels) => {
  const plan = getPlanConfig(planId);
  const limit = plan.limits.maxHostels;

  if (currentHostels >= limit) {
    return {
      allowed: false,
      message: buildLimitMessage("hostel", planId, limit),
    };
  }

  return { allowed: true };
};

export const canAddRoom = (planId, currentRooms) => {
  const plan = getPlanConfig(planId);
  const limit = plan.limits.maxRooms;

  if (currentRooms >= limit) {
    return {
      allowed: false,
      message: buildLimitMessage("room", planId, limit),
    };
  }

  return { allowed: true };
};

export const canAddTenant = (planId, currentTenants) => {
  const plan = getPlanConfig(planId);
  const limit = plan.limits.maxTenants;

  if (currentTenants >= limit) {
    return {
      allowed: false,
      message: buildLimitMessage("tenant", planId, limit),
    };
  }

  return { allowed: true };
};

export const hasFeature = (planId, featureName) => {
  const plan = getPlanConfig(planId);
  const allowed = Boolean(plan.features[featureName]);

  if (allowed) {
    return { allowed: true };
  }

  const upgradePlan = getUpgradePlanLabel(planId);
  return {
    allowed: false,
    message: `This feature is available in a higher plan. Upgrade to ${upgradePlan} to continue.`,
  };
};

export const assertCanAddHostel = async (user) => {
  const planId = normalizePlanId(user.subscriptionPlan);
  const usage = await getManagerUsage(user._id);
  const check = canAddHostel(planId, usage.hostels);

  if (!check.allowed) {
    throw new AppError(check.message, 403);
  }
};

export const assertCanAddRoom = async (user) => {
  const planId = normalizePlanId(user.subscriptionPlan);
  const usage = await getManagerUsage(user._id);
  const check = canAddRoom(planId, usage.rooms);

  if (!check.allowed) {
    throw new AppError(check.message, 403);
  }
};

export const assertCanAddTenant = async (user) => {
  const planId = normalizePlanId(user.subscriptionPlan);
  const usage = await getManagerUsage(user._id);
  const check = canAddTenant(planId, usage.tenants);

  if (!check.allowed) {
    throw new AppError(check.message, 403);
  }
};

export const assertHasFeature = (user, featureName) => {
  const planId = normalizePlanId(user.subscriptionPlan);
  const check = hasFeature(planId, featureName);

  if (!check.allowed) {
    throw new AppError(check.message, 403);
  }
};

export const assertResidentMobileAppAccess = async (residentUserId) => {
  const tenancy = await Tenancy.findOne({
    resident: residentUserId,
    status: "active",
  }).lean();

  if (!tenancy) {
    return;
  }

  const hostel = await Hostel.findById(tenancy.hostel).select("manager").lean();
  if (!hostel?.manager) {
    return;
  }

  const manager = await User.findById(hostel.manager).select("subscriptionPlan").lean();
  if (!manager) {
    return;
  }

  const check = hasFeature(
    normalizePlanId(manager.subscriptionPlan),
    PLAN_FEATURES.tenant_mobile_app,
  );

  if (!check.allowed) {
    throw new AppError(
      "The resident mobile app is not available on your hostel's current plan. Please contact your hostel manager.",
      403,
    );
  }
};
