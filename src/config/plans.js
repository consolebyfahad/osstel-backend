export const PLAN_IDS = ["free", "standard", "premium"];

export const normalizePlanId = (plan) =>
  plan === "basic" ? "standard" : plan || "free";

export const PLAN_RANK = { free: 0, standard: 1, basic: 1, premium: 2 };

export const PLAN_FEATURES = {
  tenant_management: "tenant_management",
  room_management: "room_management",
  rent_tracking: "rent_tracking",
  attendance: "attendance",
  reports: "reports",
  notifications: "notifications",
  expense_tracking: "expense_tracking",
  tenant_mobile_app: "tenant_mobile_app",
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
      maxTenants: 30,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      attendance: true,
      reports: false,
      notifications: false,
      expense_tracking: false,
      tenant_mobile_app: false,
      data_export: false,
      multi_hostel: false,
      advanced_reports: false,
      priority_support: false,
    },
  },
  standard: {
    id: "standard",
    name: "Starter",
    price: 1999,
    limits: {
      maxHostels: 1,
      maxRooms: 25,
      maxTenants: 75,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      attendance: true,
      reports: true,
      notifications: true,
      expense_tracking: true,
      tenant_mobile_app: true,
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
      maxTenants: 250,
    },
    features: {
      tenant_management: true,
      room_management: true,
      rent_tracking: true,
      attendance: true,
      reports: true,
      notifications: true,
      expense_tracking: true,
      tenant_mobile_app: true,
      data_export: true,
      multi_hostel: true,
      advanced_reports: true,
      priority_support: true,
    },
  },
};

const UPGRADE_LABELS = {
  free: "Starter",
  standard: "Pro",
  premium: "Pro",
};

export const getPlanConfig = (planId) => {
  const normalized = normalizePlanId(planId);
  return PLANS[normalized] ?? PLANS.free;
};

export const getUpgradePlanLabel = (planId) => {
  const normalized = normalizePlanId(planId);
  return UPGRADE_LABELS[normalized] ?? "Starter";
};

export const buildPlanFeatureLabels = (planId) => {
  const plan = getPlanConfig(planId);
  const { limits } = plan;

  const labels = [
    `Up to ${limits.maxHostels} hostel${limits.maxHostels === 1 ? "" : "s"}`,
    `Up to ${limits.maxRooms} rooms`,
    `Up to ${limits.maxTenants} tenants`,
    "Tenant management",
    "Room management",
    "Rent tracking",
    "Attendance",
  ];

  if (plan.features.reports) labels.push("Reports");
  if (plan.features.notifications) labels.push("Notifications");
  if (plan.features.expense_tracking) labels.push("Expense tracking");
  if (plan.features.tenant_mobile_app) labels.push("Tenant mobile app");
  if (plan.features.data_export) labels.push("Data export");
  if (plan.features.multi_hostel) labels.push("Multi-hostel management");
  if (plan.features.advanced_reports) labels.push("Advanced reports");
  if (plan.features.priority_support) labels.push("Priority support");

  if (plan.id === "free") {
    return labels;
  }

  if (plan.id === "standard") {
    return [
      "Everything in Free",
      "Up to 25 rooms",
      "Up to 75 tenants",
      "Reports",
      "Notifications",
      "Expense tracking",
      "Tenant mobile app",
      "Data export",
    ];
  }

  return [
    "Everything in Starter",
    "Up to 5 hostels",
    "Up to 75 rooms",
    "Up to 250 tenants",
    "Multi-hostel management",
    "Advanced reports",
    "Priority support",
    "Future premium features",
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
