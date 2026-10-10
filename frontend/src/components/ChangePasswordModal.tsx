import { useState, type FormEvent } from "react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { Button, ErrorBanner, Modal, SuccessBanner } from "./ui";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      {success ? (
        <div className="flex flex-col gap-3">
          <SuccessBanner message="Your password has been changed." />
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-gray-700">Current password</label>
            <input
              type="password"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">New password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">Confirm new password</label>
            <input
              type="password"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Changing…" : "Change password"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
