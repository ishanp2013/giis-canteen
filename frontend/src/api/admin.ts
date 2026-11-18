import { api } from "./client";
import type {
  AdminFeedback,
  AdminReservation,
  Analytics,
  AuditLog,
  FeedbackCategory,
  FeedbackStatus,
  ReservationStatus,
  Role,
  Settings,
  User,
} from "./types";

export interface UserInput {
  login_id: string;
  email: string;
  password: string;
  role: Role;
  name?: string;
  grade?: string;
  section?: string;
}

export interface UserUpdateInput {
  email?: string;
  role?: Role;
  name?: string;
  grade?: string;
  section?: string;
}

export const adminApi = {
  listUsers: () => api.get<User[]>("/admin/users"),
  getUser: (id: number) => api.get<User>(`/admin/users/${id}`),
  createUser: (payload: UserInput) => api.post<User>("/admin/users", payload),
  updateUser: (id: number, payload: UserUpdateInput) => api.patch<User>(`/admin/users/${id}`, payload),
  deleteUser: (id: number) => api.delete<void>(`/admin/users/${id}`),
  resetPassword: (id: number) => api.post<{ temporary_password: string }>(`/admin/users/${id}/reset-password`),

  getSettings: () => api.get<Settings>("/admin/settings"),
  updateSettings: (cutoff_time: string) => api.patch<Settings>("/admin/settings", { cutoff_time }),

  getAnalytics: () => api.get<Analytics>("/admin/analytics"),

  getLogs: (params?: { user_id?: number; action?: string }) => {
    const query = new URLSearchParams();
    if (params?.user_id) query.set("user_id", String(params.user_id));
    if (params?.action) query.set("action", params.action);
    const qs = query.toString();
    return api.get<AuditLog[]>(`/admin/logs${qs ? `?${qs}` : ""}`);
  },

  listReservations: (params: { start_date: string; end_date: string; status?: ReservationStatus }) => {
    const query = new URLSearchParams({ start_date: params.start_date, end_date: params.end_date });
    if (params.status) query.set("status", params.status);
    return api.get<AdminReservation[]>(`/admin/reservations?${query}`);
  },

  listFeedback: (params?: { category?: FeedbackCategory; status?: FeedbackStatus }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return api.get<AdminFeedback[]>(`/admin/feedback${qs ? `?${qs}` : ""}`);
  },
  updateFeedbackStatus: (id: number, status: FeedbackStatus) =>
    api.patch<AdminFeedback>(`/admin/feedback/${id}`, { status }),
};
