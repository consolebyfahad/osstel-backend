import Tenancy from "../models/Tenancy.js";

export const getActiveTenancy = async (residentId) =>
  Tenancy.findOne({ resident: residentId, status: "active" })
    .populate("room", "roomNumber")
    .populate("hostel", "name manager");

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() ?? value.id?.toString?.() ?? null;
};

export const formatComplaint = (complaint) => ({
  id: toId(complaint._id ?? complaint.id),
  title: complaint.title,
  description: complaint.description,
  status: complaint.status,
  createdAt: complaint.createdAt,
  updatedAt: complaint.updatedAt ?? null,
  hostel: complaint.hostel
    ? {
        id: toId(complaint.hostel),
        name: complaint.hostel.name ?? "",
      }
    : null,
  room: complaint.room
    ? {
        id: toId(complaint.room),
        roomNumber: complaint.room.roomNumber ?? "",
      }
    : null,
  resident: complaint.resident
    ? {
        id: toId(complaint.resident),
        name: complaint.resident.name ?? "",
        phone: complaint.resident.phone ?? undefined,
      }
    : null,
});

export const formatComplaints = (complaints) =>
  complaints.map((complaint) => formatComplaint(complaint));
