import Hostel from "../models/Hostel.js";
import Room from "../models/Room.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import { buildPagination } from "./pagination.js";
import { buildCaseInsensitiveRegex } from "./regexHelpers.js";

const normalizePlan = (plan) => (plan === "basic" ? "standard" : plan);

function buildSearchFilter(search) {
  if (!search?.trim()) return {};
  const pattern = buildCaseInsensitiveRegex(search);
  return {
    $or: [
      { name: pattern },
      { city: pattern },
      { address: pattern },
    ],
  };
}

async function attachHostelDirectoryStats(hostels, { includeOwnerPlan = false, includeContacts = true } = {}) {
  return Promise.all(
    hostels.map(async (hostel) => {
      const [rooms, activeTenancies] = await Promise.all([
        Room.find({ hostel: hostel._id }).select("capacity").lean(),
        Tenancy.find({ hostel: hostel._id, status: "active" }).select("room").lean(),
      ]);

      const roomsCount = rooms.length;
      const totalBeds = rooms.reduce((sum, room) => sum + (room.capacity ?? 0), 0);
      const tenantsCount = activeTenancies.length;
      const vacantBeds = Math.max(0, totalBeds - tenantsCount);
      const occupiedRoomIds = new Set(
        activeTenancies.map((tenancy) => String(tenancy.room)),
      );
      const vacantRooms = Math.max(0, roomsCount - occupiedRoomIds.size);

      const owner = hostel.manager
        ? {
            ...(includeOwnerPlan ? { id: String(hostel.manager._id) } : {}),
            name: hostel.manager.name,
            ...(includeContacts ? { phone: hostel.manager.phone ?? "" } : {}),
            ...(includeOwnerPlan
              ? {
                  status: hostel.manager.status || "active",
                  subscriptionPlan: normalizePlan(
                    hostel.manager.subscriptionPlan,
                  ),
                }
              : {}),
          }
        : null;

      return {
        id: String(hostel._id),
        name: hostel.name,
        address: hostel.address,
        city: hostel.city,
        image: hostel.image || null,
        ...(includeContacts ? { contactPhone: hostel.contactPhone } : {}),
        roomsCount,
        tenantsCount,
        vacantBeds,
        vacantRooms,
        hasVacancy: vacantBeds > 0,
        ...(includeOwnerPlan
          ? { status: tenantsCount > 0 ? "active" : "vacant" }
          : {}),
        owner,
        createdAt: hostel.createdAt,
      };
    }),
  );
}

async function buildDirectoryFilter(search, excludeBlockedOwners) {
  const filter = buildSearchFilter(search);

  if (!excludeBlockedOwners) {
    return filter;
  }

  const activeManagerIds = await User.find({
    role: "manager",
    status: { $ne: "blocked" },
  }).distinct("_id");

  return {
    ...filter,
    manager: { $in: activeManagerIds },
  };
}

export async function fetchHostelDirectory({
  search,
  page,
  limit,
  skip,
  excludeBlockedOwners = true,
  includeOwnerPlan = false,
  includeContacts = true,
}) {
  const filter = await buildDirectoryFilter(search, excludeBlockedOwners);

  const [hostelsRaw, total] = await Promise.all([
    Hostel.find(filter)
      .populate({
        path: "manager",
        select: includeOwnerPlan
          ? "name phone status subscriptionPlan"
          : "name phone status",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Hostel.countDocuments(filter),
  ]);

  const hostelsWithStats = await attachHostelDirectoryStats(hostelsRaw, {
    includeOwnerPlan,
    includeContacts,
  });

  return {
    hostels: hostelsWithStats,
    pagination: buildPagination(total, page, limit),
  };
}
