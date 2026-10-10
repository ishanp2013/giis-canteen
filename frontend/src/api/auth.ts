import { api } from "./client";
import type { AuthUser } from "./types";

export const authApi = {
  login: (login_id: string, password: string) =>
    api.post<AuthUser>("/auth/login", { login_id, password }),
  me: () => api.get<AuthUser>("/auth/me"),
  logout: () => api.post<{ detail: string }>("/auth/logout"),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ detail: string }>("/auth/change-password", { current_password, new_password }),
};
