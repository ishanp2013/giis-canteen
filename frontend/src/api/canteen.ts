import { api, downloadFile } from "./client";
import type { Availability, MenuItem, ReservationCount, ReservationStatus, StaffReservation } from "./types";

export interface MenuItemInput {
  name: string;
  description?: string;
}

export interface AvailabilityInput {
  menu_item_id: number;
  available_date: string;
  quantity_available: number;
}

export const canteenApi = {
  listMenuItems: () => api.get<MenuItem[]>("/canteen/menu"),
  createMenuItem: (payload: MenuItemInput) => api.post<MenuItem>("/canteen/menu", payload),
  updateMenuItem: (id: number, payload: Partial<MenuItemInput>) =>
    api.patch<MenuItem>(`/canteen/menu/${id}`, payload),
  deleteMenuItem: (id: number) => api.delete<void>(`/canteen/menu/${id}`),

  listAvailability: (availableDate?: string) =>
    api.get<Availability[]>(`/canteen/availability${availableDate ? `?available_date=${availableDate}` : ""}`),
  createAvailability: (payload: AvailabilityInput) => api.post<Availability>("/canteen/availability", payload),
  updateAvailability: (id: number, quantity_available: number) =>
    api.patch<Availability>(`/canteen/availability/${id}`, { quantity_available }),
  deleteAvailability: (id: number) => api.delete<void>(`/canteen/availability/${id}`),

  listReservations: (pickupDate?: string) =>
    api.get<StaffReservation[]>(`/canteen/reservations${pickupDate ? `?pickup_date=${pickupDate}` : ""}`),
  getSummary: (pickupDate?: string) =>
    api.get<ReservationCount[]>(`/canteen/reservations/summary${pickupDate ? `?pickup_date=${pickupDate}` : ""}`),
  updateReservationStatus: (id: number, status: ReservationStatus) =>
    api.patch<StaffReservation>(`/canteen/reservations/${id}`, { status }),

  downloadDailyReport: (date: string) => downloadFile(`/canteen/reports/daily?pickup_date=${date}`, `reservations_${date}.csv`),
  downloadWeeklyReport: (startDate: string) =>
    downloadFile(`/canteen/reports/weekly?start_date=${startDate}`, `reservations_week_${startDate}.csv`),
};
