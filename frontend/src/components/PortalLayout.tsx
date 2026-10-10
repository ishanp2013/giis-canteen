import { useState, type ComponentType } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { IconClose, IconKey, IconLogout, IconMenuBars } from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  canteen_staff: "Canteen Staff",
  school_admin: "School Admin",
};

function SidebarContent({ title, navItems, onNavigate }: { title: string; navItems: NavItem[]; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <img src="/logo.svg" alt="GIIS" className="h-8 w-auto shrink-0 rounded bg-white/95 p-1" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide text-white">GIIS Canteen</p>
          <p className="truncate text-xs text-white/50">{title}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-blue text-white shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium text-white">{user?.login_id}</p>
        <p className="truncate text-xs text-white/50">{user ? ROLE_LABELS[user.role] : ""}</p>
        <button
          onClick={() => setShowChangePassword(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <IconKey className="h-4 w-4" />
          Change password
        </button>
        <button
          onClick={() => void logout()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <IconLogout className="h-4 w-4" />
          Log out
        </button>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}

export function PortalLayout({ title, navItems }: { title: string; navItems: NavItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 shrink-0 bg-brand-navy md:flex">
        <SidebarContent title={title} navItems={navItems} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 w-64 bg-brand-navy shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-white/70 hover:text-white"
              aria-label="Close menu"
            >
              <IconClose className="h-5 w-5" />
            </button>
            <SidebarContent title={title} navItems={navItems} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-brand-navy">
            <IconMenuBars className="h-6 w-6" />
          </button>
          <img src="/logo.svg" alt="GIIS" className="h-6 w-auto" />
          <span className="text-sm font-semibold text-brand-navy">{title}</span>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 md:px-8">
          GIIS Canteen Pre-Order &amp; Reservation System · v1.0
        </footer>
      </div>
    </div>
  );
}
