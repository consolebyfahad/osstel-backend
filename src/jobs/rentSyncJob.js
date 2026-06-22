import { syncCurrentMonthRentForAllResidents } from "../utils/rentHelpers.js";
import { sendMonthlyRentReminders } from "../utils/rentNotificationHelpers.js";

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
    } catch (error) {
      console.error("[rent-sync] failed:", error.message);
    }
  };

  run("startup");
  setInterval(() => run("daily"), DAY_MS);
};
