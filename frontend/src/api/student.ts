import { api } from "./client";
import type { Availability, Reservation } from "./types";

export const studentApi = {
  getMenu: () => api.get<Availability[]>("/menu"),
  reserve: (availability_id: number, quantity: number) =>
    api.post<Reservation>("/reservations", { availability_id, quantity }),
  reserveMany: (items: { availability_id: number; quantity: number }[]) =>
    api.post<Reservation[]>("/reservations/batch", { items }),
  updateQuantity: (id: number, quantity: number) => api.patch<Reservation>(`/reservations/${id}`, { quantity }),
  cancelReservation: (id: number) => api.delete<Reservation>(`/reservations/${id}`),
  getMyReservations: () => api.get<Reservation[]>("/reservations/mine"),
};
