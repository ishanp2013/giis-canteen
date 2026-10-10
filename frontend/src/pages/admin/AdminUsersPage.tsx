import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { adminApi, type UserInput, type UserUpdateInput } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { Role, User } from "../../api/types";
import { Button, Card, ErrorBanner, Modal, PageHeading, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { IconEdit } from "../../components/icons";

const emptyForm: UserInput = {
  login_id: "",
  email: "",
  password: "",
  role: "student",
  name: "",
  grade: "",
  section: "",
};

const ROLE_GROUPS: { role: Role; label: string }[] = [
  { role: "student", label: "Students" },
  { role: "canteen_staff", label: "Canteen Staff" },
  { role: "school_admin", label: "School Admins" },
];

const ROLE_BADGE_LABELS: Record<Role, string> = {
  student: "Student",
  canteen_staff: "Canteen Staff",
  school_admin: "School Admin",
};

function displayName(user: User): string {
  return user.student?.name ?? user.login_id;
}

function editFormFromUser(user: User): UserUpdateInput {
  return {
    email: user.email,
    role: user.role,
    name: user.student?.name ?? "",
    grade: user.student?.grade ?? "",
    section: user.student?.section ?? "",
  };
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [form, setForm] = useState<UserInput>(emptyForm);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UserUpdateInput>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setUsers(await adminApi.listUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const groupedUsers = useMemo(() => {
    if (!users) return [];
    return ROLE_GROUPS.map((group) => ({
      ...group,
      users: users
        .filter((u) => u.role === group.role)
        .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    })).filter((group) => group.users.length > 0);
  }, [users]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await adminApi.createUser(form);
      setForm(emptyForm);
      setShowAddModal(false);
      setNotice(`Account "${form.login_id}" created.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setEditForm(editFormFromUser(user));
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await adminApi.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      setNotice(`Account "${editingUser.login_id}" updated.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: User) {
    setError(null);
    try {
      await adminApi.deleteUser(user.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete account.");
    }
  }

  async function handleResetPassword(user: User) {
    setError(null);
    setNotice(null);
    try {
      const { temporary_password } = await adminApi.resetPassword(user.id);
      setNotice(`New temporary password for ${user.login_id}: ${temporary_password}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    }
  }

  return (
    <div>
      <PageHeading
        subtitle="Manage student, canteen staff, and admin accounts."
        action={<Button onClick={() => setShowAddModal(true)}>+ Add account</Button>}
      >
        Accounts
      </PageHeading>

      <div className="mb-4 flex flex-col gap-2">
        {error && <ErrorBanner message={error} />}
        {notice && <SuccessBanner message={notice} />}
      </div>

      <Card className="overflow-hidden p-0">
        {users === null && (
          <div className="p-4">
            <LoadingScreen />
          </div>
        )}

        {users?.length === 0 && <p className="p-4 text-sm text-gray-500">No accounts yet.</p>}

        {groupedUsers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Login ID</th>
                  <th className="whitespace-nowrap px-4 py-3">Email</th>
                  <th className="whitespace-nowrap px-4 py-3">Grade/Section</th>
                  <th className="whitespace-nowrap px-4 py-3">Role</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedUsers.map((group) => (
                  <Fragment key={group.role}>
                    <tr className="bg-brand-navy/5">
                      <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold text-brand-navy">
                        {group.label} · {group.users.length}
                      </td>
                    </tr>
                    {group.users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                          {displayName(user)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{user.login_id}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{user.email}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                          {user.student ? `${user.student.grade} / ${user.student.section}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {ROLE_BADGE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" title="Edit account" onClick={() => openEdit(user)}>
                              <IconEdit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="secondary"
                              title="Reset password"
                              onClick={() => void handleResetPassword(user)}
                            >
                              Reset
                            </Button>
                            <Button variant="danger" onClick={() => void handleDelete(user)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAddModal && (
        <Modal title="Add account" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Login ID</label>
              <input
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={form.login_id}
                onChange={(e) => setForm({ ...form, login_id: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Temporary password</label>
              <input
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Role</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="student">Student</option>
                <option value="canteen_staff">Canteen Staff</option>
                <option value="school_admin">School Admin</option>
              </select>
            </div>
            {form.role === "student" && (
              <div className="flex gap-2">
                <input
                  required
                  placeholder="Name"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  required
                  placeholder="Grade"
                  className="w-16 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                />
                <input
                  required
                  placeholder="Section"
                  className="w-16 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                />
              </div>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Edit ${editingUser.login_id}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={editForm.email ?? ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Role</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
              >
                <option value="student">Student</option>
                <option value="canteen_staff">Canteen Staff</option>
                <option value="school_admin">School Admin</option>
              </select>
            </div>
            {editForm.role === "student" && (
              <div className="flex gap-2">
                <input
                  required
                  placeholder="Name"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <input
                  required
                  placeholder="Grade"
                  className="w-16 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={editForm.grade ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                />
                <input
                  required
                  placeholder="Section"
                  className="w-16 min-w-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  value={editForm.section ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                />
              </div>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
