import Payment from "../models/Payment.js";
import Tenancy from "../models/Tenancy.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  buildRentSummary,
  buildResidentYearSummary,
  ensureResidentRentRecord,
  filterRentRecords,
  formatRentRecord,
  formatTenancyContext,
  getManagerHostel,
  syncMonthlyRent,
} from "../utils/rentHelpers.js";

const parseRentPeriod = (query) => {
  const now = new Date();
  const month =
    query.month !== undefined && query.month !== ""
      ? Number.parseInt(query.month, 10)
      : now.getMonth() + 1;
  const year =
    query.year !== undefined && query.year !== ""
      ? Number.parseInt(query.year, 10)
      : now.getFullYear();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("Invalid month. Use 1-12.", 400);
  }

  if (!Number.isInteger(year) || year < 2000) {
    throw new AppError("Invalid year.", 400);
  }

  return { month, year };
};

const getPaymentForUser = async (paymentId, user) => {
  const payment = await Payment.findById(paymentId)
    .populate("resident", "name phone role")
    .populate("room", "roomNumber rent")
    .populate("hostel", "name manager");

  if (!payment) throw new AppError("Payment record not found", 404);

  if (user.role === "manager") {
    if (payment.hostel.manager.toString() !== user._id.toString()) {
      throw new AppError("Not authorized for this hostel", 403);
    }
  } else if (payment.resident._id.toString() !== user._id.toString()) {
    throw new AppError("Not authorized for this payment", 403);
  }

  return payment;
};

const updatePaymentStatus = async (payment, updates) => {
  Object.assign(payment, updates);
  await payment.save();
  await payment.populate(["resident", "room", "hostel"]);
  return formatRentRecord(payment);
};

const getActiveTenancy = async (residentId) =>
  Tenancy.findOne({ resident: residentId, status: "active" });

const buildMyRentResponse = async (residentId, month, year) => {
  const { tenancy, payment } = await ensureResidentRentRecord(
    residentId,
    month,
    year,
  );

  const context = formatTenancyContext(tenancy);
  const populatedPayment = payment
    ? await Payment.findById(payment._id)
        .populate("resident", "name phone")
        .populate("room", "roomNumber rent")
        .populate("hostel", "name address city contactPhone")
        .lean()
    : null;

  const record = populatedPayment ? formatRentRecord(populatedPayment) : null;

  return {
    month,
    year,
    rent: record,
    record,
    hostel: context.hostel,
    room: context.room,
  };
};

export const getRentCollection = asyncHandler(async (req, res) => {
  const { hostelId, month, year, status = "all" } = req.query;

  if (!hostelId) throw new AppError("hostelId is required", 400);

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const now = new Date();
  const targetMonth = month ? Number(month) : now.getMonth() + 1;
  const targetYear = year ? Number(year) : now.getFullYear();

  await syncMonthlyRent(hostel._id, targetMonth, targetYear);

  const payments = await Payment.find({
    hostel: hostel._id,
    month: targetMonth,
    year: targetYear,
  })
    .populate("resident", "name phone")
    .populate("room", "roomNumber")
    .sort({ createdAt: -1 })
    .lean();

  const formatted = payments.map((p) => formatRentRecord(p));
  const records = filterRentRecords(formatted, status);

  return success(res, "Rent collection fetched successfully", {
    hostel: { id: hostel._id, name: hostel.name },
    month: targetMonth,
    year: targetYear,
    summary: buildRentSummary(formatted),
    records,
  });
});

export const submitRentPayment = asyncHandler(async (req, res) => {
  const { paymentProof, note } = req.body;
  const payment = await getPaymentForUser(req.params.id, req.user);

  if (!paymentProof) {
    throw new AppError("paymentProof is required", 400);
  }

  if (!["pending", "rejected"].includes(payment.status)) {
    throw new AppError("Only pending or rejected payments can be submitted", 400);
  }

  const record = await updatePaymentStatus(payment, {
    status: "review",
    paymentProof,
    note: note || null,
    submittedAt: new Date(),
    rejectionReason: null,
    reviewedAt: null,
    reviewedBy: null,
  });

  return success(res, "Rent payment submitted for review", { record, rent: record });
});

export const submitRentForReview = submitRentPayment;

export const updateRentStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const payment = await getPaymentForUser(req.params.id, req.user);
  const record = await applyRentStatusUpdate(payment, {
    status,
    rejectionReason,
    reviewedBy: req.user._id,
  });

  return success(res, "Rent status updated successfully", { record, rent: record });
});

const applyRentStatusUpdate = async (payment, { status, rejectionReason, reviewedBy }) => {
  if (status === "paid" || status === "approved") {
    if (payment.status === "paid") {
      throw new AppError("Payment is already marked paid", 400);
    }

    return updatePaymentStatus(payment, {
      status: "paid",
      paidAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: null,
    });
  }

  if (status === "rejected") {
    if (payment.status !== "review") {
      throw new AppError("Only payments in review can be rejected", 400);
    }

    return updatePaymentStatus(payment, {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: rejectionReason || "Payment rejected by manager",
      paidAt: null,
    });
  }

  throw new AppError("Invalid status. Use paid, approved, or rejected", 400);
};

export const approveRent = asyncHandler(async (req, res) => {
  const payment = await getPaymentForUser(req.params.id, req.user);

  if (payment.status !== "review") {
    throw new AppError("Only payments in review can be approved", 400);
  }

  const record = await applyRentStatusUpdate(payment, {
    status: "paid",
    reviewedBy: req.user._id,
  });

  return success(res, "Rent approved successfully", { record, rent: record });
});

export const rejectRent = asyncHandler(async (req, res) => {
  const payment = await getPaymentForUser(req.params.id, req.user);
  const record = await applyRentStatusUpdate(payment, {
    status: "rejected",
    rejectionReason: req.body.reason || req.body.rejectionReason,
    reviewedBy: req.user._id,
  });

  return success(res, "Rent rejected", { record, rent: record });
});

export const markRentPaid = asyncHandler(async (req, res) => {
  const payment = await getPaymentForUser(req.params.id, req.user);
  const record = await applyRentStatusUpdate(payment, {
    status: "paid",
    reviewedBy: req.user._id,
  });

  return success(res, "Rent marked as paid", { record, rent: record });
});

export const getMyRent = asyncHandler(async (req, res) => {
  const { month, year } = parseRentPeriod(req.query);
  const data = await buildMyRentResponse(req.user._id, month, year);

  return success(res, "Your rent record fetched successfully", data);
});

export const getMyRentHistory = asyncHandler(async (req, res) => {
  const now = new Date();
  const targetYear =
    req.query.year !== undefined && req.query.year !== ""
      ? Number.parseInt(req.query.year, 10)
      : now.getFullYear();

  if (!Number.isInteger(targetYear) || targetYear < 2000) {
    throw new AppError("Invalid year.", 400);
  }

  const tenancy = await getActiveTenancy(req.user._id);

  if (!tenancy) {
    return success(res, "Rent history fetched successfully", {
      year: targetYear,
      summary: buildResidentYearSummary([]),
      history: [],
    });
  }

  for (let month = 1; month <= 12; month += 1) {
    await ensureResidentRentRecord(req.user._id, month, targetYear);
  }

  const payments = await Payment.find({
    resident: req.user._id,
    year: targetYear,
  })
    .populate("room", "roomNumber rent")
    .populate("hostel", "name")
    .sort({ month: 1 })
    .lean();

  const history = payments.map((payment) => formatRentRecord(payment));

  return success(res, "Rent history fetched successfully", {
    year: targetYear,
    summary: buildResidentYearSummary(history),
    history,
  });
});
