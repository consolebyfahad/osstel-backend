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
      await ensurePaymentForTenancy(tenancy, month, year);
    } catch (error) {
      console.error(
        "[syncMonthlyRent] failed for tenancy:",
        tenancy._id,
        error.message,
      );
    }
  }
};

export const findPaymentForTenancy = async (tenancy, month, year) => {
  const roomId = tenancy.room?._id ?? tenancy.room;
  const queries = [{ tenancy: tenancy._id, month, year }];

  if (tenancy.resident) {
    queries.push({ resident: tenancy.resident, room: roomId, month, year });
  }

  return Payment.findOne({ $or: queries });
};

export const ensurePaymentForTenancy = async (tenancy, month, year) => {
  const roomId = tenancy.room?._id ?? tenancy.room;
  if (!roomId) {
    throw new Error("Tenancy room is required to create a payment");
  }

  const dueDate = new Date(year, month - 1, 1);
  const baseAmount = getTenancyMonthlyRent(tenancy);
  const hostelId = tenancy.hostel?._id ?? tenancy.hostel;

  let payment = await findPaymentForTenancy(tenancy, month, year);

  if (!payment) {
    payment = await Payment.create({
      resident: tenancy.resident || null,
      tenancy: tenancy._id,
      room: roomId,
      hostel: hostelId,
      baseAmount,
      charges: [],
      amount: baseAmount,
      month,
      year,
      dueDate,
      status: "pending",
    });
  } else {
    if (tenancy.resident && !payment.resident) {
      payment.resident = tenancy.resident;
    }
    if (!payment.tenancy) {
      payment.tenancy = tenancy._id;
    }
    if (payment.baseAmount == null) {
      payment.baseAmount = baseAmount;
      if (!payment.charges?.length) {
        payment.amount = baseAmount;
      }
    }
    await payment.save();
  }

  return payment;
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

  const payment = await ensurePaymentForTenancy(tenancy, month, year);

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

export const formatRentRecord = (payment) => {
  const baseAmount =
    payment.baseAmount != null ? payment.baseAmount : payment.amount;
  const charges = (payment.charges ?? []).map((charge) => ({
    type: charge.type,
    label: charge.label,
    units: charge.units ?? null,
    rate: charge.rate ?? null,
    amount: charge.amount,
    meterReadingId: charge.meterReadingId
      ? String(charge.meterReadingId)
      : null,
  }));

  return {
    id: payment._id,
    amount: payment.amount,
    baseAmount,
    charges,
    billFinalizedAt: payment.billFinalizedAt ?? null,
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
      : payment.tenancy
        ? {
            id: payment.tenancy._id,
            name: payment.tenancy.name,
            phone: payment.tenancy.phone,
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
  };
};
