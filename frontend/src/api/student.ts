import { api } from "./client";
import type { Availability, Reservation } from "./types";

export const studentApi = {
  getMenu: () => api.get<Availability[]>("/menu"),
  reserve: (availability_id: number) => api.post<Reservation>("/reservations", { availability_id }),
  cancelReservation: (id: number) => api.delete<Reservation>(`/reservations/${id}`),
  getMyReservations: () => api.get<Reservation[]>("/reservations/mine"),
};
