import Tenancy from "../models/Tenancy.js";
import Payment from "../models/Payment.js";
import Complaint from "../models/Complaint.js";
import Room from "../models/Room.js";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatAmount = (amount) =>
  `Rs ${amount.toLocaleString("en-PK")}`;

export const getRecentActivities = async (hostelId, limit = 20) => {
  const [tenancies, payments, complaints, rooms] = await Promise.all([
    Tenancy.find({ hostel: hostelId })
      .populate("resident", "name")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Payment.find({ hostel: hostelId })
      .populate("resident", "name")
      .populate("room", "roomNumber")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    Complaint.find({ hostel: hostelId })
      .populate("resident", "name")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Room.find({ hostel: hostelId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const activities = [];

  for (const tenancy of tenancies) {
    activities.push({
      id: `resident-added-${tenancy._id}`,
      type: "resident_added",
      title: "Resident added",
      description: `${tenancy.resident.name} added to Room ${tenancy.room.roomNumber}`,
      resident: { name: tenancy.resident.name },
      room: { roomNumber: tenancy.room.roomNumber },
      createdAt: tenancy.createdAt,
    });

    if (tenancy.status === "moved_out" && tenancy.checkOutDate) {
      activities.push({
        id: `resident-removed-${tenancy._id}`,
        type: "resident_removed",
        title: "Resident removed",
        description: `${tenancy.resident.name} moved out from Room ${tenancy.room.roomNumber}`,
        resident: { name: tenancy.resident.name },
        room: { roomNumber: tenancy.room.roomNumber },
        createdAt: tenancy.checkOutDate,
      });
    }
  }

  for (const payment of payments) {
    const monthLabel = monthNames[payment.month - 1];
    const residentName = payment.resident.name;
    const roomNumber = payment.room.roomNumber;

    if (payment.submittedAt) {
      activities.push({
        id: `rent-submitted-${payment._id}`,
        type: "rent_submitted",
        title: "Rent submitted for review",
        description: `${residentName} submitted ${monthLabel} ${payment.year} rent for Room ${roomNumber}`,
        amount: payment.amount,
        resident: { name: residentName },
        room: { roomNumber },
        createdAt: payment.submittedAt,
      });
    }

    if (payment.paidAt) {
      activities.push({
        id: `rent-received-${payment._id}`,
        type: "rent_received",
        title: "Rent received",
        description: `${formatAmount(payment.amount)} received from ${residentName} (Room ${roomNumber})`,
        amount: payment.amount,
        resident: { name: residentName },
        room: { roomNumber },
        createdAt: payment.paidAt,
      });
    }

    if (payment.status === "rejected" && payment.reviewedAt) {
      activities.push({
        id: `rent-rejected-${payment._id}`,
        type: "rent_rejected",
        title: "Rent rejected",
        description: `${residentName}'s rent for Room ${roomNumber} was rejected`,
        amount: payment.amount,
        resident: { name: residentName },
        room: { roomNumber },
        createdAt: payment.reviewedAt,
      });
    }
  }

  for (const complaint of complaints) {
    activities.push({
      id: `complaint-${complaint._id}`,
      type: "complaint_filed",
      title: "New complaint",
      description: `${complaint.resident.name}: ${complaint.title}`,
      resident: { name: complaint.resident.name },
      room: complaint.room ? { roomNumber: complaint.room.roomNumber } : null,
      status: complaint.status,
      createdAt: complaint.createdAt,
    });
  }

  for (const room of rooms) {
    activities.push({
      id: `room-added-${room._id}`,
      type: "room_added",
      title: "Room added",
      description: `Room ${room.roomNumber} added (${formatAmount(room.rent)}/month)`,
      room: { roomNumber: room.roomNumber },
      amount: room.rent,
      createdAt: room.createdAt,
    });
  }

  return activities
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
};
