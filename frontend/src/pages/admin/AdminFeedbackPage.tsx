import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { AdminFeedback, FeedbackCategory, FeedbackStatus } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { FeedbackStatusBadge } from "../FeedbackPage";

const ROLE_LABELS: Record<AdminFeedback["role"], string> = {
  student: "Student",
  teacher: "Teacher",
  canteen_staff: "Canteen staff",
  school_admin: "Admin",
};

export function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedback[] | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [status, setStatus] = useState<FeedbackStatus | "">("open");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load(forCategory: FeedbackCategory | "", forStatus: FeedbackStatus | "") {
    setItems(null);
    try {
      setItems(await adminApi.listFeedback({ category: forCategory || undefined, status: forStatus || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load feedback.");
    }
  }

  useEffect(() => {
    void load(category, status);
  }, [category, status]);

  async function handleStatus(id: number, next: FeedbackStatus) {
    setError(null);
    setUpdatingId(id);
    try {
      await adminApi.updateFeedbackStatus(id, next);
      await load(category, status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update feedback.");
    } finally {
      setUpdatingId(null);
    }
  }

  const selectClasses = "rounded-md border border-gray-300 px-2 py-1 text-sm";

  return (
    <div>
      <PageHeading subtitle="Suggestions and complaints sent by students, teachers and canteen staff.">Feedback</PageHeading>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          Type
          <select className={selectClasses} value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory | "")}>
            <option value="">All</option>
            <option value="suggestion">Suggestions</option>
            <option value="complaint">Complaints</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Status
          <select className={selectClasses} value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | "")}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {items === null && !error && <LoadingScreen />}

      <div className="flex flex-col gap-2">
        {items?.length === 0 && (
          <Card>
            <p className="text-sm text-gray-500">No matching messages.</p>
          </Card>
        )}
        {items?.map((f) => (
          <Card key={f.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      f.category === "complaint" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {f.category}
                  </span>
                  {f.subject}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {ROLE_LABELS[f.role]} · {f.sender_name ? `${f.sender_name} (${f.login_id})` : f.login_id} ·{" "}
                  {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FeedbackStatusBadge status={f.status} />
                <Button
                  variant="secondary"
                  disabled={updatingId === f.id}
                  onClick={() => void handleStatus(f.id, f.status === "open" ? "resolved" : "open")}
                >
                  {f.status === "open" ? "Mark resolved" : "Reopen"}
                </Button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{f.message}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
