import Tenancy from "../models/Tenancy.js";
import Payment from "../models/Payment.js";
import { getManagerHostel } from "./hostelHelpers.js";

export { getManagerHostel };

export const getTenancyMonthlyRent = (tenancy) => {
  if (tenancy.monthlyRent != null && tenancy.monthlyRent >= 0) {
    return tenancy.monthlyRent;
  }
  return tenancy.room?.rent ?? 0;
};

/** First and last calendar month (1–12) a tenancy should have rent for a given year. */
export const getTenancyRentMonthBounds = (tenancy, targetYear, now = new Date()) => {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (targetYear > currentYear) {
    return { startMonth: null, endMonth: null };
  }

  const checkIn = tenancy?.checkInDate ? new Date(tenancy.checkInDate) : null;
  if (!checkIn || Number.isNaN(checkIn.getTime())) {
    const endMonth = targetYear < currentYear ? 12 : currentMonth;
    return { startMonth: 1, endMonth };
  }

  const checkInYear = checkIn.getFullYear();
  const checkInMonth = checkIn.getMonth() + 1;

  if (targetYear < checkInYear) {
    return { startMonth: null, endMonth: null };
  }

  const startMonth = targetYear > checkInYear ? 1 : checkInMonth;
  const endMonth = targetYear < currentYear ? 12 : currentMonth;

  if (startMonth > endMonth) {
    return { startMonth: null, endMonth: null };
  }

  return { startMonth, endMonth };
};

export const getEligibleRentMonths = (tenancy, targetYear, now = new Date()) => {
  const { startMonth, endMonth } = getTenancyRentMonthBounds(
    tenancy,
    targetYear,
    now,
  );
  if (startMonth == null || endMonth == null) return [];

  const months = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(month);
  }
  return months;
};

export const syncMonthlyRent = async (hostelId, month, year) => {
  const dueDate = new Date(year, month - 1, 1);
  const now = new Date();

  const tenancies = await Tenancy.find({
    hostel: hostelId,
    status: "active",
  }).populate("room");

  for (const tenancy of tenancies) {
    if (!tenancy.room?._id) continue;

    const eligibleMonths = getEligibleRentMonths(tenancy, year, now);
    if (!eligibleMonths.includes(month)) continue;

    try {
      const existing = await Payment.findOne({
        resident: tenancy.resident,
        room: tenancy.room._id,
        month,
        year,
      });

      if (!existing) {
        await Payment.create({
          resident: tenancy.resident,
          room: tenancy.room._id,
          hostel: hostelId,
          amount: getTenancyMonthlyRent(tenancy),
          month,
          year,
          dueDate,
          status: "pending",
        });
      }
    } catch (error) {
      console.error("[syncMonthlyRent] failed for resident:", tenancy.resident, error.message);
    }
  }
};

export const ensureResidentRentRecord = async (residentId, month, year) => {
  const tenancy = await Tenancy.findOne({
    resident: residentId,
    status: "active",
  })
    .populate("room")
    .populate("hostel", "name address city contactPhone");

  if (!tenancy || !tenancy.room?._id) {
    return { tenancy: null, payment: null };
  }

  const eligibleMonths = getEligibleRentMonths(tenancy, year);
  if (!eligibleMonths.includes(month)) {
    return { tenancy, payment: null };
  }

  const dueDate = new Date(year, month - 1, 1);
  let payment = await Payment.findOne({
    resident: residentId,
    room: tenancy.room._id,
    month,
    year,
  });

  if (!payment) {
    payment = await Payment.create({
      resident: residentId,
      room: tenancy.room._id,
      hostel: tenancy.hostel._id,
      amount: getTenancyMonthlyRent(tenancy),
      month,
      year,
      dueDate,
      status: "pending",
    });
  }

  return { tenancy, payment };
};

export const seedRentForNewTenancy = async (residentId, checkInDate = new Date()) => {
  const month = checkInDate.getMonth() + 1;
  const year = checkInDate.getFullYear();
  return ensureResidentRentRecord(residentId, month, year);
};

export const syncCurrentMonthRentForAllResidents = async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const tenancies = await Tenancy.find({ status: "active" }).select("resident");

  for (const tenancy of tenancies) {
    await ensureResidentRentRecord(tenancy.resident, month, year);
  }

  return { month, year, activeTenancies: tenancies.length };
};

export const formatTenancyContext = (tenancy) => ({
  hostel: tenancy?.hostel
    ? {
        id: tenancy.hostel._id,
        name: tenancy.hostel.name,
        address: tenancy.hostel.address,
        city: tenancy.hostel.city,
        contactPhone: tenancy.hostel.contactPhone,
      }
    : null,
  room: tenancy?.room
    ? {
        id: tenancy.room._id,
        roomNumber: tenancy.room.roomNumber,
        rent: getTenancyMonthlyRent(tenancy),
        defaultRent: tenancy.room.rent,
      }
    : null,
});

export const buildRentSummary = (records) => {
  const now = new Date();

  const summary = {
    expected: 0,
    collected: 0,
    pending: 0,
    review: 0,
    overdue: 0,
  };

  for (const record of records) {
    summary.expected += record.amount;

    if (record.status === "paid") {
      summary.collected += record.amount;
    } else if (record.status === "review") {
      summary.review += record.amount;
    }

    if (["pending", "rejected", "review"].includes(record.status)) {
      summary.pending += record.amount;
    }

    if (record.status !== "paid" && new Date(record.dueDate) < now) {
      summary.overdue += record.amount;
    }
  }

  return summary;
};

export const buildResidentYearSummary = (records) => {
  const summary = {
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    reviewAmount: 0,
    overdueAmount: 0,
    paidMonths: 0,
    pendingMonths: 0,
    totalMonths: records.length,
  };

  const now = new Date();

  for (const record of records) {
    summary.totalAmount += record.amount;

    if (record.status === "paid") {
      summary.paidAmount += record.amount;
      summary.paidMonths += 1;
    } else {
      summary.pendingAmount += record.amount;
      summary.pendingMonths += 1;
    }

    if (record.status === "review") {
      summary.reviewAmount += record.amount;
    }

    if (record.status !== "paid" && new Date(record.dueDate) < now) {
      summary.overdueAmount += record.amount;
    }
  }

  return summary;
};

export const filterRentRecords = (records, status) => {
  const now = new Date();

  if (!status || status === "all") return records;

  const filters = {
    paid: (r) => r.status === "paid",
    pending: (r) => ["pending", "rejected"].includes(r.status),
    review: (r) => r.status === "review",
    overdue: (r) => r.status !== "paid" && new Date(r.dueDate) < now,
  };

  return records.filter(filters[status] || (() => true));
};

export const formatRentRecord = (payment) => ({
  id: payment._id,
  amount: payment.amount,
  month: payment.month,
  year: payment.year,
  status: payment.status,
  dueDate: payment.dueDate,
  paymentProof: payment.paymentProof,
  note: payment.note || null,
  submittedAt: payment.submittedAt,
  paidAt: payment.paidAt,
  reviewedAt: payment.reviewedAt,
  rejectionReason: payment.rejectionReason,
  isOverdue:
    payment.status !== "paid" && new Date(payment.dueDate) < new Date(),
  resident: payment.resident
    ? {
        id: payment.resident._id,
        name: payment.resident.name,
        phone: payment.resident.phone,
      }
    : null,
  room: payment.room
    ? {
        id: payment.room._id,
        roomNumber: payment.room.roomNumber,
        rent: payment.room.rent,
      }
    : null,
  hostel: payment.hostel
    ? {
        id: payment.hostel._id,
        name: payment.hostel.name,
      }
    : null,
});
