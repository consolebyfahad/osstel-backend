import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { notifyUser } from "../services/pushNotificationService.js";
import {
  getEffectivePlanId,
} from "./trialHelpers.js";
import {
  hasFeature,
  PLAN_FEATURES,
} from "./subscriptionHelpers.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const RENT_NOTIFICATION_URL = "/(tabs)/rent";

export function formatRentPeriodLabel(month, year) {
  return `${MONTH_NAMES[month - 1] ?? "Month"} ${year}`;
}

export function buildRentReminderBody(month, year, amount) {
  const period = formatRentPeriodLabel(month, year);
  const amountLabel =
    amount != null ? ` Amount due: Rs ${Number(amount).toLocaleString()}.` : "";
  return `Your ${period} rent is due. Please submit your payment by the 5th.${amountLabel}`;
}

export async function notifyRentReminder(residentId, payment, options = {}) {
  const month = payment.month ?? new Date().getMonth() + 1;
  const year = payment.year ?? new Date().getFullYear();
  const type = options.type ?? "rent_reminder";
  const body =
    options.body ??
    buildRentReminderBody(month, year, payment.amount);

  await notifyUser(residentId, {
    title: options.title ?? "Rent reminder",
    body,
    type,
    data: {
      paymentId: payment._id.toString(),
      month: String(month),
      year: String(year),
      url: RENT_NOTIFICATION_URL,
    },
  });
}

export async function sendMonthlyRentReminders() {
  const now = new Date();
  if (now.getDate() !== 1) {
    return { sent: 0, skipped: true, reason: "not_first_of_month" };
  }

  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const periodKey = `${year}-${month}`;

  const payments = await Payment.find({
    month,
    year,
    status: { $in: ["pending", "rejected"] },
    reminderSentForPeriod: { $ne: periodKey },
  })
    .select("_id resident amount month year hostel")
    .populate("hostel", "manager");

  let sent = 0;
  let skipped = 0;

  for (const payment of payments) {
    try {
      const managerId = payment.hostel?.manager;
      if (managerId) {
        const manager = await User.findById(managerId)
          .select(
            "subscriptionPlan baseSubscriptionPlan trialPlan trialEndsAt planExpiresAt",
          )
          .lean();
        const reminderAllowed = manager
          ? hasFeature(getEffectivePlanId(manager), PLAN_FEATURES.rent_reminders)
              .allowed
          : false;

        if (!reminderAllowed) {
          skipped += 1;
          continue;
        }
      }

      await notifyRentReminder(payment.resident, payment, {
        type: "rent_reminder_monthly",
        title: `${formatRentPeriodLabel(month, year)} rent due`,
      });
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { reminderSentForPeriod: periodKey } },
      );
      sent += 1;
    } catch (error) {
      console.error(
        "[rent-reminder] failed for payment:",
        payment._id,
        error.message,
      );
    }
  }

  return { sent, skipped, month, year, skippedAll: false };
}
