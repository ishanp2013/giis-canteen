export type Role = "student" | "canteen_staff" | "school_admin";

// "reserved" means waiting for canteen staff to accept or reject the order.
export type ReservationStatus = "reserved" | "accepted" | "rejected" | "prepared" | "collected" | "cancelled";

export interface AuthUser {
  id: number;
  login_id: string;
  role: Role;
}

export interface Student {
  name: string;
  grade: string;
  section: string;
}

export interface User {
  id: number;
  login_id: string;
  email: string;
  role: Role;
  created_at: string;
  student: Student | null;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
}

export interface Availability {
  id: number;
  menu_item_id: number;
  menu_item_name: string;
  description: string | null;
  price: number;
  available_date: string;
  quantity_available: number;
  remaining_availability: number;
}

export interface Reservation {
  id: number;
  student_id: number;
  availability_id: number;
  menu_item_id: number;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  status: ReservationStatus;
  reserved_at: string;
  pickup_date: string;
  rejection_reason: string | null;
}

export interface StaffReservation extends Omit<Reservation, "menu_item_id"> {
  student_name: string;
  reviewed_at: string | null;
}

export interface AdminReservation extends StaffReservation {
  student_grade: string;
  student_section: string;
  reviewed_by_login_id: string | null;
}

export type FeedbackCategory = "suggestion" | "complaint";
export type FeedbackStatus = "open" | "resolved";

export interface Feedback {
  id: number;
  category: FeedbackCategory;
  subject: string;
  message: string;
  status: FeedbackStatus;
  created_at: string;
}

export interface AdminFeedback extends Feedback {
  user_id: number;
  login_id: string;
  role: Role;
  student_name: string | null;
}

export interface ReservationCount {
  menu_item_id: number;
  menu_item_name: string;
  reserved_count: number;
}

export interface Settings {
  cutoff_time: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  timestamp: string;
  metadata_json: Record<string, unknown> | null;
}

export interface PopularItem {
  menu_item_name: string;
  reservation_count: number;
}

export interface Analytics {
  total_reservations: number;
  total_cancelled: number;
  popular_items: PopularItem[];
  waste_avoided: number;
}
