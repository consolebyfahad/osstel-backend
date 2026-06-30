import Room from "../models/Room.js";
import RoomMeter from "../models/RoomMeter.js";
import MeterReading from "../models/MeterReading.js";
import Tenancy from "../models/Tenancy.js";
import { getTenancyMonthlyRent, ensurePaymentForTenancy } from "./rentHelpers.js";

export const formatRoomMeter = (meter) => ({
  id: String(meter._id),
  roomId: String(meter.room),
  hostelId: String(meter.hostel),
  name: meter.name,
  unitLabel: meter.unitLabel,
  ratePerUnit: meter.ratePerUnit,
  lastReading: meter.lastReading ?? 0,
  isActive: meter.isActive !== false,
  createdAt: meter.createdAt,
});

export const formatMeterReading = (reading, meter) => ({
  id: String(reading._id),
  meterId: String(reading.meter),
  meterName: meter?.name ?? null,
  unitLabel: meter?.unitLabel ?? reading.unitLabel ?? "unit",
  month: reading.month,
  year: reading.year,
  previousReading: reading.previousReading,
  currentReading: reading.currentReading,
  unitsConsumed: reading.unitsConsumed,
  ratePerUnit: reading.ratePerUnit,
  totalAmount: reading.totalAmount,
  recordedAt: reading.createdAt,
});

export const getActiveTenancyCountInRoom = async (roomId) => {
  return Tenancy.countDocuments({ room: roomId, status: "active" });
};

export const assertRoomMeterBillingEnabled = (room) => {
  if (!room?.separateMeterBilling) {
    throw new Error("ROOM_METER_BILLING_DISABLED");
  }
};

export const ensureDefaultRoomMeter = async (roomId, hostelId) => {
  const count = await RoomMeter.countDocuments({
    room: roomId,
    hostel: hostelId,
    isActive: true,
  });

  if (count > 0) return null;

  return RoomMeter.create({
    room: roomId,
    hostel: hostelId,
    name: "Electricity",
    unitLabel: "kWh",
    ratePerUnit: 0,
    lastReading: 0,
  });
};

export const getRoomBillingSettings = async (roomId) => {
  const room = await Room.findById(roomId)
    .select("separateMeterBilling freeUnits")
    .lean();

  return {
    separateMeterBilling: room?.separateMeterBilling === true,
    freeUnits: room?.freeUnits ?? 0,
  };
};

export const getRoomMeterReadingsForPeriod = async (roomId, month, year) => {
  const readings = await MeterReading.find({ room: roomId, month, year })
    .populate("meter")
    .lean();

  return readings.map((reading) =>
    formatMeterReading(reading, reading.meter),
  );
};

export const buildMeterChargesForResident = (
  readings,
  residentCount,
  freeUnits = 0,
) => {
  if (!readings.length || residentCount < 1) return [];

  const parsedFreeUnits = Math.max(0, Number(freeUnits) || 0);

  return readings.map((reading) => {
    const rawUnits = reading.unitsConsumed ?? 0;
    const billableRoomUnits = Math.max(0, rawUnits - parsedFreeUnits);
    const totalBillableAmount =
      Math.round(billableRoomUnits * (reading.ratePerUnit ?? 0) * 100) / 100;
    const shareAmount =
      Math.round((totalBillableAmount / residentCount) * 100) / 100;
    const shareUnits =
      Math.round((billableRoomUnits / residentCount) * 100) / 100;

    const freeUnitsNote =
      parsedFreeUnits > 0 && rawUnits > 0
        ? ` (${parsedFreeUnits} ${reading.unitLabel} free)`
        : "";

    return {
      type: "meter",
      label:
        residentCount > 1
          ? `${reading.meterName ?? "Utility"} (${shareUnits} ${reading.unitLabel} share)${freeUnitsNote}`
          : `${reading.meterName ?? "Utility"} (${billableRoomUnits} ${reading.unitLabel})${freeUnitsNote}`,
      units: residentCount > 1 ? shareUnits : billableRoomUnits,
      rate: reading.ratePerUnit,
      amount: shareAmount,
      meterReadingId: reading.id,
    };
  }).filter((charge) => charge.amount > 0);
};

export const computePaymentTotal = (baseAmount, charges = []) => {
  const chargesTotal = charges.reduce(
    (sum, charge) => sum + (charge.amount ?? 0),
    0,
  );
  return Math.round((baseAmount + chargesTotal) * 100) / 100;
};

export const applyBillToPayment = async (
  payment,
  { baseAmount, meterCharges, extraCharges = [] },
) => {
  const charges = [
    ...meterCharges,
    ...extraCharges.map((charge) => ({
      type: "extra",
      label: charge.label.trim(),
      units: null,
      rate: null,
      amount: Number(charge.amount),
      meterReadingId: null,
    })),
  ];

  payment.baseAmount = baseAmount;
  payment.charges = charges;
  payment.amount = computePaymentTotal(baseAmount, charges);
  payment.billFinalizedAt = new Date();
  await payment.save();
  return payment;
};

export const finalizeRoomBillsForPeriod = async ({
  roomId,
  hostelId,
  month,
  year,
  extraChargesByResident = {},
}) => {
  const tenancies = await Tenancy.find({
    room: roomId,
    hostel: hostelId,
    status: "active",
  })
    .populate("room")
    .populate("resident", "name");

  if (tenancies.length === 0) {
    return { finalized: [], skipped: [] };
  }

  const room = await Room.findById(roomId).select("separateMeterBilling freeUnits").lean();

  const readings = room?.separateMeterBilling
    ? await getRoomMeterReadingsForPeriod(roomId, month, year)
    : [];
  const meterCharges = room?.separateMeterBilling
    ? buildMeterChargesForResident(
        readings,
        tenancies.length,
        room.freeUnits ?? 0,
      )
    : [];

  const finalized = [];
  const skipped = [];

  for (const tenancy of tenancies) {
    const payment = await ensurePaymentForTenancy(tenancy, month, year);

    if (["paid", "review"].includes(payment.status)) {
      skipped.push({
        residentId: tenancy.resident
          ? String(tenancy.resident._id)
          : String(tenancy._id),
        reason: `Payment is ${payment.status}`,
      });
      continue;
    }

    const chargeKey = tenancy.resident
      ? String(tenancy.resident._id)
      : String(tenancy._id);
    const extras = extraChargesByResident[chargeKey] ?? [];

    await applyBillToPayment(payment, {
      baseAmount: getTenancyMonthlyRent(tenancy),
      meterCharges,
      extraCharges: extras,
    });

    finalized.push({
      paymentId: String(payment._id),
      residentId: tenancy.resident ? String(tenancy.resident._id) : null,
      tenancyId: String(tenancy._id),
      residentName: tenancy.resident?.name ?? tenancy.name,
      amount: payment.amount,
    });
  }

  return { finalized, skipped, readings };
};
