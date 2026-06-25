import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import SupportRequest from "../models/SupportRequest.js";
import ContactInquiry from "../models/ContactInquiry.js";
import { formatAdminSupportRequest } from "../utils/supportHelpers.js";
import { formatAdminContactInquiry } from "../utils/contactHelpers.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import {
  TRIAL_DURATIONS,
  TRIAL_PLAN,
  formatTrialForClient,
  getEffectivePlanId,
} from "../utils/trialHelpers.js";
import {
  activatePaidSubscription,
  extendPaidSubscription,
  clearPaidSubscription,
  formatSubscriptionPeriodForClient,
  isPaidSubscriptionActive,
  SUBSCRIPTION_PERIOD_DAYS,
} from "../utils/subscriptionLifecycleHelpers.js";
import { getPlanConfig } from "../config/plans.js";
import { notifyUser } from "../services/pushNotificationService.js";
import { hasRealPhone } from "../utils/googleUserHelpers.js";

const normalizePlan = (plan) => (plan === "basic" ? "standard" : plan);

const formatOwnerContact = (owner) => {
  const phone = hasRealPhone(owner.phone) ? owner.phone : null;
  const email = owner.email?.trim() || null;
  const authProvider = owner.authProvider || "local";

  return {
    phone: phone || "",
    email,
    authProvider,
    contact: phone || email || "—",
    contactType: phone ? "phone" : email ? "email" : null,
  };
};

const getPlanName = (planId) => getPlanConfig(normalizePlan(planId)).name;

const notifyPlanUpgrade = (ownerId, planId, adminNote) => {
  void notifyUser(ownerId, {
    title: "Plan upgraded",
    body:
      adminNote?.trim() ||
      `Your ${getPlanName(planId)} plan is now active.`,
    type: "plan_approved",
    data: { url: "/subscription" },
  });
};

const notifyPlanRejected = (ownerId, adminNote) => {
  void notifyUser(ownerId, {
    title: "Plan request declined",
    body: adminNote?.trim() || "Your upgrade request was not approved.",
    type: "plan_rejected",
    data: { url: "/subscription" },
  });
};

const notifySupportReply = (userId, adminReply, supportRequestId) => {
  const trimmed = adminReply.trim();
  if (!trimmed) return;

  void notifyUser(userId, {
    title: "Support reply",
    body:
      trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed,
    type: "support_reply",
    data: {
      supportRequestId: String(supportRequestId),
      url: "/support",
    },
  });
};

const formatOwner = (owner, hostels = []) => ({
  id: owner._id,
  name: owner.name,
  ...formatOwnerContact(owner),
  role: owner.role,
  status: owner.status || "active",
  subscriptionPlan: normalizePlan(owner.subscriptionPlan || "free"),
  effectivePlan: getEffectivePlanId(owner),
  trial: formatTrialForClient(owner),
  subscription: formatSubscriptionPeriodForClient(owner),
  hostelsCount: hostels.length,
  hostels: hostels.map((h) => ({
    id: h._id,
    name: h.name,
    address: h.address,
    city: h.city,
    contactPhone: h.contactPhone,
  })),
  createdAt: owner.createdAt,
});

export const getOwners = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, plan, search } = req.query;

  const filter = { role: "manager" };
  if (status) filter.status = status;
  if (plan) filter.subscriptionPlan = plan === "standard" ? { $in: ["standard", "basic"] } : plan;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [owners, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const ownerIds = owners.map((o) => o._id);
  const hostels = await Hostel.find({ manager: { $in: ownerIds } }).lean();
  const hostelsByManager = hostels.reduce((acc, h) => {
    const key = h.manager.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  return success(res, "Owners fetched successfully", {
    owners: owners.map((o) =>
      formatOwner(o, hostelsByManager[o._id.toString()] || [])
    ),
    pagination: buildPagination(total, page, limit),
  });
});

export const getOwnerById = asyncHandler(async (req, res) => {
  const owner = await User.findOne({
    _id: req.params.id,
    role: "manager",
  }).lean();

  if (!owner) throw new AppError("Owner not found", 404);

  const hostels = await Hostel.find({ manager: owner._id }).lean();

  const hostelsWithStats = await Promise.all(
    hostels.map(async (hostel) => {
      const [roomsCount, tenantsCount] = await Promise.all([
        Room.countDocuments({ hostel: hostel._id }),
        Tenancy.countDocuments({ hostel: hostel._id, status: "active" }),
      ]);

      return {
        id: hostel._id,
        name: hostel.name,
        address: hostel.address,
        city: hostel.city,
        contactPhone: hostel.contactPhone,
        roomsCount,
        tenantsCount,
        status: tenantsCount > 0 ? "active" : "vacant",
        createdAt: hostel.createdAt,
      };
    })
  );

  const pendingRequest = await PlanUpgradeRequest.findOne({
    owner: owner._id,
    status: "pending",
  }).lean();

  return success(res, "Owner details fetched successfully", {
    owner: {
      ...formatOwner(owner, hostels),
      hostels: hostelsWithStats,
      pendingPlanRequest: pendingRequest
        ? {
            id: pendingRequest._id,
            requestedPlan: pendingRequest.requestedPlan,
            currentPlan: normalizePlan(pendingRequest.currentPlan),
            note: pendingRequest.note,
            createdAt: pendingRequest.createdAt,
          }
        : null,
    },
  });
});

export const toggleOwnerBlock = asyncHandler(async (req, res) => {
  const { blocked } = req.body;

  const owner = await User.findOne({ _id: req.params.id, role: "manager" });

  if (!owner) throw new AppError("Owner not found", 404);

  owner.status = blocked ? "blocked" : "active";
  await owner.save();

  void notifyUser(owner._id, {
    title: blocked ? "Account suspended" : "Account restored",
    body: blocked
      ? "Your Osstel account has been suspended. Contact support if you believe this is a mistake."
      : "Your Osstel account is active again.",
    type: blocked ? "account_blocked" : "account_unblocked",
    data: { url: blocked ? "/support" : "/subscription" },
  });

  return success(res, `Owner ${blocked ? "blocked" : "unblocked"} successfully`, {
    owner: {
      id: owner._id,
      name: owner.name,
      status: owner.status,
    },
  });
});

export const updateOwnerPlan = asyncHandler(async (req, res) => {
  const { plan } = req.body;

  const owner = await User.findOne({ _id: req.params.id, role: "manager" });

  if (!owner) throw new AppError("Owner not found", 404);

  owner.subscriptionPlan = plan;
  owner.trialPlan = null;
  owner.trialEndsAt = null;

  if (plan === "free") {
    clearPaidSubscription(owner);
  } else {
    activatePaidSubscription(owner, plan);
  }

  await owner.save();

  await PlanUpgradeRequest.updateMany(
    { owner: owner._id, status: "pending" },
    {
      status: "approved",
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      adminNote: "Plan updated manually by admin",
    }
  );

  notifyPlanUpgrade(owner._id, owner.subscriptionPlan, "Your plan was updated by Osstel support.");

  return success(res, "Owner plan updated successfully", {
    owner: {
      id: owner._id,
      name: owner.name,
      subscriptionPlan: normalizePlan(owner.subscriptionPlan),
      effectivePlan: getEffectivePlanId(owner),
      trial: formatTrialForClient(owner),
      subscription: formatSubscriptionPeriodForClient(owner),
    },
  });
});

export const extendOwnerSubscription = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ _id: req.params.id, role: "manager" });

  if (!owner) throw new AppError("Owner not found", 404);

  if (!isPaidSubscriptionActive(owner) && normalizePlan(owner.subscriptionPlan) === "free") {
    throw new AppError("Owner does not have an active paid subscription to extend", 400);
  }

  extendPaidSubscription(owner);
  await owner.save();

  void notifyUser(owner._id, {
    title: "Subscription extended",
    body: `Your plan has been extended for ${SUBSCRIPTION_PERIOD_DAYS} more days.`,
    type: "subscription_extended",
    data: { url: "/subscription" },
  });

  return success(res, "Subscription extended by 1 month", {
    owner: {
      id: owner._id,
      name: owner.name,
      subscriptionPlan: normalizePlan(owner.subscriptionPlan),
      effectivePlan: getEffectivePlanId(owner),
      trial: formatTrialForClient(owner),
      subscription: formatSubscriptionPeriodForClient(owner),
    },
  });
});

export const grantOwnerTrial = asyncHandler(async (req, res) => {
  const { days } = req.body;

  if (!TRIAL_DURATIONS.includes(days)) {
    throw new AppError("Trial duration must be 10, 20, or 30 days", 400);
  }

  const owner = await User.findOne({ _id: req.params.id, role: "manager" });

  if (!owner) throw new AppError("Owner not found", 404);

  owner.trialPlan = TRIAL_PLAN;
  owner.trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await owner.save();

  void notifyUser(owner._id, {
    title: "Pro trial activated",
    body: `You have ${days} days of full Pro access.`,
    type: "trial_granted",
    data: { url: "/subscription" },
  });

  return success(res, `Pro trial granted for ${days} days`, {
    owner: {
      id: owner._id,
      name: owner.name,
      subscriptionPlan: normalizePlan(owner.subscriptionPlan),
      effectivePlan: getEffectivePlanId(owner),
      trial: formatTrialForClient(owner),
    },
  });
});

export const cancelOwnerTrial = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ _id: req.params.id, role: "manager" });

  if (!owner) throw new AppError("Owner not found", 404);

  if (!owner.trialPlan || !owner.trialEndsAt) {
    throw new AppError("This owner does not have an active trial", 400);
  }

  owner.trialPlan = null;
  owner.trialEndsAt = null;
  await owner.save();

  void notifyUser(owner._id, {
    title: "Pro trial ended",
    body: "Your Pro trial was ended early. Your subscription plan is unchanged.",
    type: "trial_cancelled",
    data: { url: "/subscription" },
  });

  return success(res, "Trial cancelled successfully", {
    owner: {
      id: owner._id,
      name: owner.name,
      subscriptionPlan: normalizePlan(owner.subscriptionPlan),
      effectivePlan: getEffectivePlanId(owner),
      trial: null,
    },
  });
});

export const getAdminHostels = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
    ];
  }

  const [hostels, total] = await Promise.all([
    Hostel.find(filter)
      .populate("manager", "name phone status subscriptionPlan")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Hostel.countDocuments(filter),
  ]);

  const hostelsWithStats = await Promise.all(
    hostels.map(async (hostel) => {
      const [roomsCount, tenantsCount] = await Promise.all([
        Room.countDocuments({ hostel: hostel._id }),
        Tenancy.countDocuments({ hostel: hostel._id, status: "active" }),
      ]);

      return {
        id: hostel._id,
        name: hostel.name,
        address: hostel.address,
        city: hostel.city,
        contactPhone: hostel.contactPhone,
        roomsCount,
        tenantsCount,
        status: tenantsCount > 0 ? "active" : "vacant",
        owner: {
          id: hostel.manager._id,
          name: hostel.manager.name,
          phone: hostel.manager.phone,
          status: hostel.manager.status,
          subscriptionPlan: normalizePlan(hostel.manager.subscriptionPlan),
        },
        createdAt: hostel.createdAt,
      };
    })
  );

  return success(res, "Hostels fetched successfully", {
    hostels: hostelsWithStats,
    pagination: buildPagination(total, page, limit),
  });
});

export const getAdminHostelById = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id)
    .populate("manager", "name phone status subscriptionPlan createdAt")
    .lean();

  if (!hostel) throw new AppError("Hostel not found", 404);

  const [rooms, tenants] = await Promise.all([
    Room.find({ hostel: hostel._id }).sort({ roomNumber: 1 }).lean(),
    Tenancy.find({ hostel: hostel._id, status: "active" })
      .populate("resident", "name phone cnic")
      .populate("room", "roomNumber")
      .lean(),
  ]);

  return success(res, "Hostel details fetched successfully", {
    hostel: {
      id: hostel._id,
      name: hostel.name,
      address: hostel.address,
      city: hostel.city,
      contactPhone: hostel.contactPhone,
      status: tenants.length > 0 ? "active" : "vacant",
      owner: {
        id: hostel.manager._id,
        name: hostel.manager.name,
        phone: hostel.manager.phone,
        status: hostel.manager.status,
        subscriptionPlan: normalizePlan(hostel.manager.subscriptionPlan),
        createdAt: hostel.manager.createdAt,
      },
      rooms: rooms.map((r) => ({
        id: r._id,
        roomNumber: r.roomNumber,
        capacity: r.capacity,
        rent: r.rent,
        status: r.status,
      })),
      tenants: tenants.map((t) => ({
        id: t.resident._id,
        tenancyId: t._id,
        name: t.resident.name,
        phone: t.resident.phone,
        cnic: t.resident.cnic,
        roomNumber: t.room.roomNumber,
        checkInDate: t.checkInDate,
      })),
      stats: {
        totalRooms: rooms.length,
        totalTenants: tenants.length,
        totalCapacity: rooms.reduce((sum, r) => sum + r.capacity, 0),
      },
      createdAt: hostel.createdAt,
    },
  });
});

export const getPlanRequests = asyncHandler(async (req, res) => {
  const { status = "pending" } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status !== "all") filter.status = status;

  const [requests, total] = await Promise.all([
    PlanUpgradeRequest.find(filter)
      .populate("owner", "name phone subscriptionPlan status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PlanUpgradeRequest.countDocuments(filter),
  ]);

  return success(res, "Plan requests fetched successfully", {
    requests: requests.map((r) => ({
      id: r._id,
      owner: {
        id: r.owner._id,
        name: r.owner.name,
        phone: r.owner.phone,
        status: r.owner.status,
        subscriptionPlan: normalizePlan(r.owner.subscriptionPlan),
      },
      currentPlan: normalizePlan(r.currentPlan),
      requestedPlan: r.requestedPlan,
      status: r.status,
      note: r.note,
      adminNote: r.adminNote,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
    pagination: buildPagination(total, page, limit),
  });
});

export const approvePlanRequest = asyncHandler(async (req, res) => {
  const { adminNote } = req.body;

  const request = await PlanUpgradeRequest.findById(req.params.id).populate(
    "owner"
  );

  if (!request) throw new AppError("Plan request not found", 404);
  if (request.status !== "pending") {
    throw new AppError("Request already processed", 400);
  }

  request.owner.subscriptionPlan = request.requestedPlan;
  activatePaidSubscription(request.owner, request.requestedPlan);
  await request.owner.save();

  request.status = "approved";
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.adminNote = adminNote || "Payment received and plan upgraded";
  await request.save();

  notifyPlanUpgrade(
    request.owner._id,
    request.requestedPlan,
    request.adminNote ||
      `Your ${getPlanName(request.requestedPlan)} plan is active for ${SUBSCRIPTION_PERIOD_DAYS} days.`,
  );

  return success(res, "Plan request approved successfully", {
    request: {
      id: request._id,
      owner: {
        id: request.owner._id,
        name: request.owner.name,
        subscriptionPlan: request.owner.subscriptionPlan,
      },
      requestedPlan: request.requestedPlan,
      status: request.status,
    },
  });
});

export const rejectPlanRequest = asyncHandler(async (req, res) => {
  const { adminNote } = req.body;

  const request = await PlanUpgradeRequest.findById(req.params.id).populate(
    "owner",
    "_id",
  );

  if (!request) throw new AppError("Plan request not found", 404);
  if (request.status !== "pending") {
    throw new AppError("Request already processed", 400);
  }

  request.status = "rejected";
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.adminNote = adminNote || "Request rejected";
  await request.save();

  notifyPlanRejected(request.owner._id, request.adminNote);

  return success(res, "Plan request rejected", {
    request: { id: request._id, status: request.status },
  });
});

export const getAdminStats = asyncHandler(async (_req, res) => {
  const [
    totalOwners,
    blockedOwners,
    totalHostels,
    pendingRequests,
    openSupportRequests,
    newContactInquiries,
    standardOwners,
    premiumOwners,
  ] = await Promise.all([
    User.countDocuments({ role: "manager" }),
    User.countDocuments({ role: "manager", status: "blocked" }),
    Hostel.countDocuments(),
    PlanUpgradeRequest.countDocuments({ status: "pending" }),
    SupportRequest.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    ContactInquiry.countDocuments({ status: "new" }),
    User.countDocuments({
      role: "manager",
      subscriptionPlan: { $in: ["standard", "basic"] },
    }),
    User.countDocuments({ role: "manager", subscriptionPlan: "premium" }),
  ]);

  return success(res, "Admin stats fetched successfully", {
    stats: {
      totalOwners,
      blockedOwners,
      totalHostels,
      pendingPlanRequests: pendingRequests,
      openSupportRequests,
      newContactInquiries,
      standardOwners,
      premiumOwners,
    },
  });
});

export const getSupportRequests = asyncHandler(async (req, res) => {
  const { status = "open", category, search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status !== "all") filter.status = status;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { subject: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { adminReply: { $regex: search, $options: "i" } },
    ];
  }

  const [requests, total] = await Promise.all([
    SupportRequest.find(filter)
      .populate("user", "name phone role")
      .populate("repliedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupportRequest.countDocuments(filter),
  ]);

  return success(res, "Support requests fetched successfully", {
    requests: requests.map(formatAdminSupportRequest),
    pagination: buildPagination(total, page, limit),
  });
});

export const getSupportRequestById = asyncHandler(async (req, res) => {
  const request = await SupportRequest.findById(req.params.id)
    .populate("user", "name phone role email subscriptionPlan")
    .populate("repliedBy", "name")
    .lean();

  if (!request) throw new AppError("Support request not found", 404);

  return success(res, "Support request fetched successfully", {
    request: formatAdminSupportRequest(request),
  });
});

export const replyToSupportRequest = asyncHandler(async (req, res) => {
  const { adminReply, status = "resolved" } = req.body;

  const request = await SupportRequest.findById(req.params.id);
  if (!request) throw new AppError("Support request not found", 404);

  if (!["in_progress", "resolved", "closed"].includes(status)) {
    throw new AppError("Invalid status for reply", 400);
  }

  request.adminReply = adminReply;
  request.status = status;
  request.repliedAt = new Date();
  request.repliedBy = req.user._id;
  await request.save();

  notifySupportReply(request.user, adminReply, request._id);

  const populated = await SupportRequest.findById(request._id)
    .populate("user", "name phone role")
    .populate("repliedBy", "name")
    .lean();

  return success(res, "Support request replied successfully", {
    request: formatAdminSupportRequest(populated),
  });
});

export const updateSupportRequestStatus = asyncHandler(async (req, res) => {
  const { status, adminReply } = req.body;

  const request = await SupportRequest.findById(req.params.id);
  if (!request) throw new AppError("Support request not found", 404);

  request.status = status;

  const trimmedReply = typeof adminReply === "string" ? adminReply.trim() : "";
  if (trimmedReply) {
    request.adminReply = trimmedReply;
    request.repliedAt = new Date();
    request.repliedBy = req.user._id;
  }

  await request.save();

  if (trimmedReply) {
    notifySupportReply(request.user, trimmedReply, request._id);
  }

  const populated = await SupportRequest.findById(request._id)
    .populate("user", "name phone role")
    .populate("repliedBy", "name")
    .lean();

  return success(res, "Support request status updated successfully", {
    request: formatAdminSupportRequest(populated),
  });
});

export const getContactInquiries = asyncHandler(async (req, res) => {
  const { status = "new", search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status !== "all") filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
    ];
  }

  const [inquiries, total] = await Promise.all([
    ContactInquiry.find(filter)
      .populate("repliedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ContactInquiry.countDocuments(filter),
  ]);

  return success(res, "Contact inquiries fetched successfully", {
    inquiries: inquiries.map(formatAdminContactInquiry),
    pagination: buildPagination(total, page, limit),
  });
});

export const getContactInquiryById = asyncHandler(async (req, res) => {
  let inquiry = await ContactInquiry.findById(req.params.id).populate(
    "repliedBy",
    "name"
  );

  if (!inquiry) throw new AppError("Contact inquiry not found", 404);

  if (inquiry.status === "new") {
    inquiry.status = "in_progress";
    await inquiry.save();
  }

  return success(res, "Contact inquiry fetched successfully", {
    inquiry: formatAdminContactInquiry(inquiry.toObject()),
  });
});

export const replyToContactInquiry = asyncHandler(async (req, res) => {
  const { adminReply, status = "replied" } = req.body;

  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw new AppError("Contact inquiry not found", 404);

  if (!["in_progress", "replied", "closed"].includes(status)) {
    throw new AppError("Invalid status for reply", 400);
  }

  inquiry.adminReply = adminReply;
  inquiry.status = status;
  inquiry.repliedAt = new Date();
  inquiry.repliedBy = req.user._id;
  await inquiry.save();

  const populated = await ContactInquiry.findById(inquiry._id)
    .populate("repliedBy", "name")
    .lean();

  return success(res, "Contact inquiry replied successfully", {
    inquiry: formatAdminContactInquiry(populated),
  });
});

export const updateContactInquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw new AppError("Contact inquiry not found", 404);

  inquiry.status = status;
  await inquiry.save();

  const populated = await ContactInquiry.findById(inquiry._id)
    .populate("repliedBy", "name")
    .lean();

  return success(res, "Contact inquiry status updated successfully", {
    inquiry: formatAdminContactInquiry(populated),
  });
});
