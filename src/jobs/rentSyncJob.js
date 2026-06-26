import { syncCurrentMonthRentForAllResidents } from "../utils/rentHelpers.js";
import { sendMonthlyRentReminders } from "../utils/rentNotificationHelpers.js";
import {
  expireAllSubscriptions,
  sendSubscriptionExpiryReminders,
} from "../utils/subscriptionLifecycleHelpers.js";
import {
  expireAllTrials,
  sendTrialExpiryReminders,
} from "../utils/trialHelpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const startRentSyncJob = () => {
  const run = async (label) => {
    try {
      const result = await syncCurrentMonthRentForAllResidents();
      console.log(
        `[rent-sync] ${label}: month=${result.month}/${result.year}, tenancies=${result.activeTenancies}`,
      );

      const reminderResult = await sendMonthlyRentReminders();
      if (!reminderResult.skipped && reminderResult.sent > 0) {
        console.log(
          `[rent-reminder] ${label}: sent=${reminderResult.sent} for ${reminderResult.month}/${reminderResult.year}`,
        );
      }

      const expiredTrials = await expireAllTrials();
      if (expiredTrials > 0) {
        console.log(`[trial-expiry] ${label}: expired=${expiredTrials}`);
      }

      const trialExpiryReminders = await sendTrialExpiryReminders();
      if (trialExpiryReminders > 0) {
        console.log(
          `[trial-expiry] ${label}: reminders=${trialExpiryReminders}`,
        );
      }

      const expiryReminders = await sendSubscriptionExpiryReminders();
      if (expiryReminders > 0) {
        console.log(
          `[subscription-expiry] ${label}: reminders=${expiryReminders}`,
        );
      }

      const expiredSubscriptions = await expireAllSubscriptions();
      if (expiredSubscriptions > 0) {
        console.log(
          `[subscription-expiry] ${label}: expired=${expiredSubscriptions}`,
        );
      }
    } catch (error) {
      console.error("[rent-sync] failed:", error.message);
    }
  };

  run("startup");
  setInterval(() => run("daily"), DAY_MS);
};
