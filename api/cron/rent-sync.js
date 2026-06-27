import { syncCurrentMonthRentForAllResidents } from "../src/utils/rentHelpers.js";
import { sendMonthlyRentReminders } from "../src/utils/rentNotificationHelpers.js";
import { expireAllTrials, sendTrialExpiryReminders } from "../src/utils/trialHelpers.js";
import {
  expireAllSubscriptions,
  sendSubscriptionExpiryReminders,
} from "../src/utils/subscriptionLifecycleHelpers.js";
import { ensureDbConnected } from "../src/config/db.js";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await ensureDbConnected();

    const syncResult = await syncCurrentMonthRentForAllResidents();
    const reminderResult = await sendMonthlyRentReminders();
    const expiredTrials = await expireAllTrials();
    const trialExpiryReminders = await sendTrialExpiryReminders();
    const expiryReminders = await sendSubscriptionExpiryReminders();
    const expiredSubscriptions = await expireAllSubscriptions();

    return res.status(200).json({
      success: true,
      message: "Rent sync completed",
      data: {
        sync: syncResult,
        reminders: reminderResult,
        expiredTrials,
        trialExpiryReminders,
        expiryReminders,
        expiredSubscriptions,
      },
    });
  } catch (error) {
    console.error("[cron/rent-sync] failed:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Rent sync failed",
    });
  }
}
