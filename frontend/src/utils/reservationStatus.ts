import type { ReservationStatus } from "../api/types";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  reserved: "awaiting acceptance",
  accepted: "accepted",
  rejected: "rejected",
  prepared: "prepared",
  collected: "collected",
  cancelled: "cancelled",
};

export const STATUS_STYLES: Record<ReservationStatus, string> = {
  reserved: "bg-blue-50 text-blue-700",
  accepted: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-700",
  prepared: "bg-amber-50 text-amber-700",
  collected: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};
