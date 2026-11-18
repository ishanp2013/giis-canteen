import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PortalLayout } from "./components/PortalLayout";
import { LoginPage } from "./pages/LoginPage";
import { StudentMenuPage } from "./pages/student/StudentMenuPage";
import { StudentHistoryPage } from "./pages/student/StudentHistoryPage";
import { CanteenMenuPage } from "./pages/canteen/CanteenMenuPage";
import { CanteenAvailabilityPage } from "./pages/canteen/CanteenAvailabilityPage";
import { CanteenReservationsPage } from "./pages/canteen/CanteenReservationsPage";
import { CanteenReportsPage } from "./pages/canteen/CanteenReportsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminAnalyticsPage } from "./pages/admin/AdminAnalyticsPage";
import { AdminLogsPage } from "./pages/admin/AdminLogsPage";
import { AdminReservationsPage } from "./pages/admin/AdminReservationsPage";
import { AdminFeedbackPage } from "./pages/admin/AdminFeedbackPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import {
  IconChart,
  IconClipboard,
  IconHistory,
  IconLogs,
  IconMenu,
  IconMessage,
  IconPackage,
  IconReport,
  IconSettings,
  IconUsers,
} from "./components/icons";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case "student":
      return <Navigate to="/student/menu" replace />;
    case "teacher":
      return <Navigate to="/teacher/menu" replace />;
    case "canteen_staff":
      return <Navigate to="/canteen/menu" replace />;
    case "school_admin":
      return <Navigate to="/admin/users" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <PortalLayout
              title="Student"
              navItems={[
                { to: "/student/menu", label: "Menu", icon: IconMenu },
                { to: "/student/history", label: "My Reservations", icon: IconHistory },
                { to: "/student/feedback", label: "Feedback", icon: IconMessage },
              ]}
            />
          </ProtectedRoute>
        }
      >
        <Route path="menu" element={<StudentMenuPage />} />
        <Route path="history" element={<StudentHistoryPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>

      {/* Teachers order meals the same way students do, so they share the student pages. */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <PortalLayout
              title="Teacher"
              navItems={[
                { to: "/teacher/menu", label: "Menu", icon: IconMenu },
                { to: "/teacher/history", label: "My Reservations", icon: IconHistory },
                { to: "/teacher/feedback", label: "Feedback", icon: IconMessage },
              ]}
            />
          </ProtectedRoute>
        }
      >
        <Route path="menu" element={<StudentMenuPage />} />
        <Route path="history" element={<StudentHistoryPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>

      <Route
        path="/canteen"
        element={
          <ProtectedRoute allowedRoles={["canteen_staff"]}>
            <PortalLayout
              title="Canteen Staff"
              navItems={[
                { to: "/canteen/menu", label: "Menu Items", icon: IconMenu },
                { to: "/canteen/availability", label: "Availability", icon: IconPackage },
                { to: "/canteen/reservations", label: "Reservations", icon: IconClipboard },
                { to: "/canteen/reports", label: "Reports", icon: IconReport },
                { to: "/canteen/feedback", label: "Feedback", icon: IconMessage },
              ]}
            />
          </ProtectedRoute>
        }
      >
        <Route path="menu" element={<CanteenMenuPage />} />
        <Route path="availability" element={<CanteenAvailabilityPage />} />
        <Route path="reservations" element={<CanteenReservationsPage />} />
        <Route path="reports" element={<CanteenReportsPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["school_admin"]}>
            <PortalLayout
              title="School Admin"
              navItems={[
                { to: "/admin/users", label: "Accounts", icon: IconUsers },
                { to: "/admin/reservations", label: "Reservations", icon: IconClipboard },
                { to: "/admin/feedback", label: "Feedback", icon: IconMessage },
                { to: "/admin/settings", label: "Settings", icon: IconSettings },
                { to: "/admin/analytics", label: "Analytics", icon: IconChart },
                { to: "/admin/logs", label: "Audit Log", icon: IconLogs },
              ]}
            />
          </ProtectedRoute>
        }
      >
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="reservations" element={<AdminReservationsPage />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
