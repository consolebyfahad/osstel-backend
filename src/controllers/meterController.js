import Room from "../models/Room.js";
import RoomMeter from "../models/RoomMeter.js";
import MeterReading from "../models/MeterReading.js";
import Tenancy from "../models/Tenancy.js";
import Payment from "../models/Payment.js";
import AppError from "../utils/AppError.js";
import { success } from "../utils/apiResponse.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getManagerHostel } from "../utils/hostelHelpers.js";
import {
  applyBillToPayment,
  buildMeterChargesForResident,
  finalizeRoomBillsForPeriod,
  formatMeterReading,
  formatRoomMeter,
  getActiveTenancyCountInRoom,
  getRoomMeterReadingsForPeriod,
} from "../utils/meterHelpers.js";
import {
  getTenancyMonthlyRent,
} from "../utils/rentHelpers.js";
import { notifyUser } from "../services/pushNotificationService.js";

const parsePeriod = (query) => {
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

const requireRoomInHostel = async (hostelId, roomId, managerId) => {
  const hostel = await getManagerHostel(hostelId, managerId);
  if (!hostel) throw new AppError("Hostel not found", 404);

  const room = await Room.findOne({ _id: roomId, hostel: hostel._id });
  if (!room) throw new AppError("Room not found in this hostel", 404);

  return { hostel, room };
};

export const getRoomMeters = asyncHandler(async (req, res) => {
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const meters = await RoomMeter.find({
    room: room._id,
    hostel: hostel._id,
  }).sort({ createdAt: 1 });

  return success(res, "Room meters fetched successfully", {
    meters: meters.map(formatRoomMeter),
  });
});

export const createRoomMeter = asyncHandler(async (req, res) => {
  const { name, unitLabel, ratePerUnit, lastReading } = req.body;
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const parsedRate = Number(ratePerUnit);
  if (Number.isNaN(parsedRate) || parsedRate < 0) {
    throw new AppError("ratePerUnit must be a non-negative number", 400);
  }

  const parsedLastReading =
    lastReading !== undefined && lastReading !== null && lastReading !== ""
      ? Number(lastReading)
      : 0;

  if (Number.isNaN(parsedLastReading) || parsedLastReading < 0) {
    throw new AppError("lastReading must be a non-negative number", 400);
  }

  const meter = await RoomMeter.create({
    room: room._id,
    hostel: hostel._id,
    name: name.trim(),
    unitLabel: (unitLabel || "unit").trim(),
    ratePerUnit: parsedRate,
    lastReading: parsedLastReading,
  });

  return success(
    res,
    "Meter added successfully",
    { meter: formatRoomMeter(meter) },
    201,
  );
});

export const updateRoomMeter = asyncHandler(async (req, res) => {
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const meter = await RoomMeter.findOne({
    _id: req.params.meterId,
    room: room._id,
    hostel: hostel._id,
  });

  if (!meter) throw new AppError("Meter not found", 404);

  if (req.body.name) meter.name = req.body.name.trim();
  if (req.body.unitLabel) meter.unitLabel = req.body.unitLabel.trim();
  if (req.body.ratePerUnit !== undefined) {
    const parsedRate = Number(req.body.ratePerUnit);
    if (Number.isNaN(parsedRate) || parsedRate < 0) {
      throw new AppError("ratePerUnit must be a non-negative number", 400);
    }
    meter.ratePerUnit = parsedRate;
  }
  if (req.body.lastReading !== undefined) {
    const parsed = Number(req.body.lastReading);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new AppError("lastReading must be a non-negative number", 400);
    }
    meter.lastReading = parsed;
  }
  if (req.body.isActive !== undefined) meter.isActive = Boolean(req.body.isActive);

  await meter.save();

  return success(res, "Meter updated successfully", {
    meter: formatRoomMeter(meter),
  });
});

export const deleteRoomMeter = asyncHandler(async (req, res) => {
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const meter = await RoomMeter.findOne({
    _id: req.params.meterId,
    room: room._id,
    hostel: hostel._id,
  });

  if (!meter) throw new AppError("Meter not found", 404);

  await MeterReading.deleteMany({ meter: meter._id });
  await meter.deleteOne();

  return success(res, "Meter deleted successfully");
});

export const getRoomMeterReadings = asyncHandler(async (req, res) => {
  const { month, year } = parsePeriod(req.query);
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const [meters, readings, residentCount] = await Promise.all([
    RoomMeter.find({ room: room._id, hostel: hostel._id, isActive: true }).sort({
      createdAt: 1,
    }),
    getRoomMeterReadingsForPeriod(room._id, month, year),
    getActiveTenancyCountInRoom(room._id),
  ]);

  const readingByMeterId = new Map(readings.map((r) => [r.meterId, r]));

  return success(res, "Meter readings fetched successfully", {
    month,
    year,
    residentCount,
    meters: meters.map((meter) => ({
      ...formatRoomMeter(meter),
      reading: readingByMeterId.get(String(meter._id)) ?? null,
    })),
    readings,
  });
});

export const recordRoomMeterReadings = asyncHandler(async (req, res) => {
  const { month, year, readings } = req.body;
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  if (!Array.isArray(readings) || readings.length === 0) {
    throw new AppError("readings array is required", 400);
  }

  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new AppError("Invalid month. Use 1-12.", 400);
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
    throw new AppError("Invalid year.", 400);
  }

  const saved = [];

  for (const entry of readings) {
    const meter = await RoomMeter.findOne({
      _id: entry.meterId,
      room: room._id,
      hostel: hostel._id,
      isActive: true,
    });

    if (!meter) {
      throw new AppError(`Meter not found: ${entry.meterId}`, 404);
    }

    const currentReading = Number(entry.currentReading);
    if (Number.isNaN(currentReading) || currentReading < 0) {
      throw new AppError("currentReading must be a non-negative number", 400);
    }

    const previousReading = meter.lastReading ?? 0;
    if (currentReading < previousReading) {
      throw new AppError(
        `Current reading for ${meter.name} cannot be less than previous reading (${previousReading})`,
        400,
      );
    }

    const unitsConsumed = currentReading - previousReading;
    const totalAmount = Math.round(unitsConsumed * meter.ratePerUnit * 100) / 100;

    const reading = await MeterReading.findOneAndUpdate(
      { meter: meter._id, month: parsedMonth, year: parsedYear },
      {
        room: room._id,
        hostel: hostel._id,
        month: parsedMonth,
        year: parsedYear,
        previousReading,
        currentReading,
        unitsConsumed,
        ratePerUnit: meter.ratePerUnit,
        totalAmount,
        recordedBy: req.user._id,
      },
      { upsert: true, new: true },
    );

    meter.lastReading = currentReading;
    await meter.save();

    saved.push(formatMeterReading(reading, meter));
  }

  return success(res, "Meter readings saved successfully", {
    month: parsedMonth,
    year: parsedYear,
    readings: saved,
  });
});

export const finalizeRoomBills = asyncHandler(async (req, res) => {
  const { month, year, extraChargesByResident = {} } = req.body;
  const { hostel, room } = await requireRoomInHostel(
    req.params.hostelId,
    req.params.roomId,
    req.user._id,
  );

  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new AppError("Invalid month. Use 1-12.", 400);
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
    throw new AppError("Invalid year.", 400);
  }

  const result = await finalizeRoomBillsForPeriod({
    roomId: room._id,
    hostelId: hostel._id,
    month: parsedMonth,
    year: parsedYear,
    extraChargesByResident,
  });

  for (const item of result.finalized) {
    if (!item.residentId) continue;

    void notifyUser(item.residentId, {
      title: "Rent bill ready",
      body: `Your ${parsedMonth}/${parsedYear} bill is Rs ${item.amount.toLocaleString()}. Open Rent to view the breakdown.`,
      type: "rent_bill_finalized",
      data: { paymentId: item.paymentId },
    });
  }

  return success(res, "Room bills finalized successfully", result);
});

export const getRentBillPreview = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("resident", "name phone")
    .populate("room", "roomNumber rent")
    .populate("hostel", "name manager");

  if (!payment) throw new AppError("Payment record not found", 404);

  if (payment.hostel.manager.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized for this payment", 403);
  }

  const tenancyQuery = payment.resident
    ? { resident: payment.resident._id, room: payment.room._id, status: "active" }
    : payment.tenancy
      ? { _id: payment.tenancy, status: "active" }
      : null;

  const tenancy = tenancyQuery
    ? await Tenancy.findOne(tenancyQuery)
    : null;

  if (tenancy) {
    await tenancy.populate("room");
  }

  const residentCount = await getActiveTenancyCountInRoom(payment.room._id);
  const readings = await getRoomMeterReadingsForPeriod(
    payment.room._id,
    payment.month,
    payment.year,
  );
  const meterCharges = buildMeterChargesForResident(readings, residentCount);
  const baseAmount = tenancy
    ? getTenancyMonthlyRent(tenancy)
    : payment.baseAmount ?? payment.amount;

  return success(res, "Bill preview fetched successfully", {
    paymentId: String(payment._id),
    month: payment.month,
    year: payment.year,
    status: payment.status,
    baseAmount,
    meterCharges,
    currentCharges: payment.charges ?? [],
    billFinalizedAt: payment.billFinalizedAt,
    residentCount,
    readings,
  });
});

export const finalizeRentBill = asyncHandler(async (req, res) => {
  const { extraCharges = [] } = req.body;

  const payment = await Payment.findById(req.params.id)
    .populate("resident", "name")
    .populate("room")
    .populate("hostel", "name manager");

  if (!payment) throw new AppError("Payment record not found", 404);

  if (payment.hostel.manager.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized for this payment", 403);
  }

  if (["paid", "review"].includes(payment.status)) {
    throw new AppError(
      `Cannot finalize bill while payment is ${payment.status}`,
      400,
    );
  }

  const tenancyQuery = payment.resident
    ? { resident: payment.resident._id, room: payment.room._id, status: "active" }
    : payment.tenancy
      ? { _id: payment.tenancy, status: "active" }
      : null;

  if (!tenancyQuery) {
    throw new AppError("Active tenancy not found for this payment", 404);
  }

  const tenancy = await Tenancy.findOne(tenancyQuery).populate("room");

  if (!tenancy) {
    throw new AppError("Active tenancy not found for this payment", 404);
  }

  const residentCount = await getActiveTenancyCountInRoom(payment.room._id);
  const readings = await getRoomMeterReadingsForPeriod(
    payment.room._id,
    payment.month,
    payment.year,
  );
  const meterCharges = buildMeterChargesForResident(readings, residentCount);
  const baseAmount = getTenancyMonthlyRent(tenancy);

  const parsedExtras = (extraCharges ?? []).map((charge) => {
    const amount = Number(charge.amount);
    if (Number.isNaN(amount) || amount < 0) {
      throw new AppError("Each extra charge amount must be non-negative", 400);
    }
    if (!charge.label?.trim()) {
      throw new AppError("Each extra charge requires a label", 400);
    }
    return { label: charge.label.trim(), amount };
  });

  await applyBillToPayment(payment, {
    baseAmount,
    meterCharges,
    extraCharges: parsedExtras,
  });

  await payment.populate(["resident", "room", "hostel"]);

  const notifyResidentId = payment.resident?._id ?? payment.resident;
  if (notifyResidentId) {
    void notifyUser(notifyResidentId, {
      title: "Rent bill ready",
      body: `Your bill for ${payment.month}/${payment.year} is Rs ${payment.amount.toLocaleString()}.`,
      type: "rent_bill_finalized",
      data: {
        paymentId: String(payment._id),
        type: "rent_bill_finalized",
        url: "/(tabs)/rent",
      },
    });
  }

  const { formatRentRecord } = await import("../utils/rentHelpers.js");

  return success(res, "Rent bill finalized successfully", {
    record: formatRentRecord(payment),
  });
});
