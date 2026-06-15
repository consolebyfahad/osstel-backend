import { syncCurrentMonthRentForAllResidents } from "../utils/rentHelpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const startRentSyncJob = () => {
  const run = async (label) => {
    try {
      const result = await syncCurrentMonthRentForAllResidents();
      console.log(
        `[rent-sync] ${label}: month=${result.month}/${result.year}, tenancies=${result.activeTenancies}`,
      );
    } catch (error) {
      console.error("[rent-sync] failed:", error.message);
    }
  };

  run("startup");
  setInterval(() => run("daily"), DAY_MS);
};
