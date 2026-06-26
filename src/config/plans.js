export const PLAN_IDS = ["free", "standard", "premium"];

export const UNLIMITED_TENANTS = null;

export const normalizePlanId = (plan) =>
  plan === "basic" ? "standard" : plan || "free";

export const PLAN_RANK = { free: 0, standard: 1, basic: 1, premium: 2 };

export const PLAN_FEATURES = {
  tenant_management: "tenant_management",
  room_management: "room_management",
  rent_tracking: "rent_tracking",
  reports: "reports",
  notifications: "notifications",
  expense_tracking: "expense_tracking",
  complaints: "complaints",
  payment_proof: "payment_proof",
  support: "support",
  rent_reminders: "rent_reminders",
  data_export: "data_export",
  multi_hostel: "multi_hostel",
  advanced_reports: "advanced_reports",
  priority_support: "priority_support",
};

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    limits: {
      maxHostels: 1,
      maxRooms: 10,
      maxTenants: UNLIMITED_TENANTS,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      reports: false,
      notifications: false,
      expense_tracking: false,
      complaints: false,
      payment_proof: false,
      support: false,
      rent_reminders: false,
      data_export: false,
      multi_hostel: false,
      advanced_reports: false,
      priority_support: false,
    },
  },
  standard: {
    id: "standard",
    name: "Standard",
    price: 1999,
    limits: {
      maxHostels: 1,
      maxRooms: 25,
      maxTenants: UNLIMITED_TENANTS,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      reports: true,
      notifications: true,
      expense_tracking: true,
      complaints: true,
      payment_proof: true,
      support: true,
      rent_reminders: true,
      data_export: true,
      multi_hostel: false,
      advanced_reports: false,
      priority_support: false,
    },
  },
  premium: {
    id: "premium",
    name: "Pro",
    price: 2999,
    limits: {
      maxHostels: 5,
      maxRooms: 75,
      maxTenants: UNLIMITED_TENANTS,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      reports: true,
      notifications: true,
      expense_tracking: true,
      complaints: true,
      payment_proof: true,
      support: true,
      rent_reminders: true,
      data_export: true,
      multi_hostel: true,
      advanced_reports: true,
      priority_support: true,
    },
  },
};

const UPGRADE_LABELS = {
  free: "Standard",
  standard: "Pro",
  premium: "Pro",
};

export const getPlanConfig = (planId) => {
  const normalized = normalizePlanId(planId);
  return PLANS[normalized] ?? PLANS.free;
};

export const getUpgradePlanLabel = (planId) => {
  const normalized = normalizePlanId(planId);
  return UPGRADE_LABELS[normalized] ?? "Standard";
};

export const buildPlanFeatureLabels = (planId) => {
  const plan = getPlanConfig(planId);
  const { limits } = plan;

  if (plan.id === "free") {
    return [
      `Up to ${limits.maxHostels} hostel`,
      `Up to ${limits.maxRooms} rooms`,
      "Unlimited tenants",
      "Tenant management",
      "Manual payment marking",
      "Basic hostel management",
    ];
  }

  if (plan.id === "standard") {
    return [
      "Everything in Free",
      `Up to ${limits.maxRooms} rooms`,
      "Push notifications",
      "Expense tracking",
      "Reports & analytics",
      "Complaint system",
      "Payment proof upload",
      "Automatic rent reminders",
      "Alert messages",
      "Support",
    ];
  }

  return [
    "Everything in Standard",
    `Up to ${limits.maxHostels} hostels`,
    `Up to ${limits.maxRooms} rooms`,
    "Priority support",
    "All reports",
    "Full analytics",
    "All premium features",
  ];
};

export const getPlansCatalog = () =>
  PLAN_IDS.map((id) => {
    const plan = PLANS[id];
    return {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      features: buildPlanFeatureLabels(plan.id),
      limits: plan.limits,
    };
  });
