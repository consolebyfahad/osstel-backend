import Expense from "../models/Expense.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getManagerHostel } from "../utils/hostelHelpers.js";
import {
  formatExpense,
  parseExpensePeriod,
} from "../utils/expenseHelpers.js";
import {
  assertHasFeature,
  PLAN_FEATURES,
} from "../utils/subscriptionHelpers.js";

export const createExpense = asyncHandler(async (req, res) => {
  assertHasFeature(req.user, PLAN_FEATURES.expense_tracking);
  const { hostelId, title, details, amount, image, month, year } = req.body;

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
    throw new AppError("amount must be a non-negative number", 400);
  }

  const now = new Date();
  const expenseMonth =
    month !== undefined && month !== "" ? Number.parseInt(month, 10) : now.getMonth() + 1;
  const expenseYear =
    year !== undefined && year !== "" ? Number.parseInt(year, 10) : now.getFullYear();

  if (!Number.isInteger(expenseMonth) || expenseMonth < 1 || expenseMonth > 12) {
    throw new AppError("Invalid month. Use 1-12.", 400);
  }

  if (!Number.isInteger(expenseYear) || expenseYear < 2000) {
    throw new AppError("Invalid year.", 400);
  }

  const expense = await Expense.create({
    manager: req.user._id,
    hostel: hostel._id,
    title: title.trim(),
    details: details?.trim() || "",
    amount: parsedAmount,
    image: image || null,
    month: expenseMonth,
    year: expenseYear,
    expenseDate: now,
  });

  const populated = await Expense.findById(expense._id)
    .populate("hostel", "name")
    .lean();

  return success(
    res,
    "Expense added successfully",
    { expense: formatExpense(populated) },
    201,
  );
});

export const getExpenses = asyncHandler(async (req, res) => {
  assertHasFeature(req.user, PLAN_FEATURES.expense_tracking);
  const { hostelId } = req.query;
  const { month, year } = parseExpensePeriod(req.query);

  if (!hostelId) throw new AppError("hostelId is required", 400);

  const hostel = await getManagerHostel(hostelId, req.user._id);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const expenses = await Expense.find({
    hostel: hostel._id,
    month,
    year,
  })
    .populate("hostel", "name")
    .sort({ createdAt: -1 })
    .lean();

  const formatted = expenses.map(formatExpense);
  const totalAmount = formatted.reduce((sum, item) => sum + item.amount, 0);

  return success(res, "Expenses fetched successfully", {
    month,
    year,
    hostel: { id: hostel._id, name: hostel.name },
    summary: {
      totalAmount,
      count: formatted.length,
    },
    expenses: formatted,
  });
});

export const getExpenseSummary = asyncHandler(async (req, res) => {
  assertHasFeature(req.user, PLAN_FEATURES.expense_tracking);
  const { month, year } = parseExpensePeriod(req.query);
  const hostelIds = req.query.hostelIds
    ? String(req.query.hostelIds)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : null;

  let hostels = [];
  if (hostelIds?.length) {
    for (const hostelId of hostelIds) {
      const hostel = await getManagerHostel(hostelId, req.user._id);
      if (hostel) hostels.push(hostel);
    }
  } else if (req.query.hostelId) {
    const hostel = await getManagerHostel(req.query.hostelId, req.user._id);
    if (!hostel) throw new AppError("Hostel not found", 404);
    hostels = [hostel];
  } else {
    throw new AppError("hostelId or hostelIds is required", 400);
  }

  const totals = await Promise.all(
    hostels.map(async (hostel) => {
      const expenses = await Expense.find({
        hostel: hostel._id,
        month,
        year,
      }).lean();

      const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

      return {
        hostelId: hostel._id.toString(),
        hostelName: hostel.name,
        totalAmount,
        count: expenses.length,
      };
    }),
  );

  const totalAmount = totals.reduce((sum, item) => sum + item.totalAmount, 0);

  return success(res, "Expense summary fetched successfully", {
    month,
    year,
    totals,
    summary: {
      totalAmount,
      count: totals.reduce((sum, item) => sum + item.count, 0),
    },
  });
});
