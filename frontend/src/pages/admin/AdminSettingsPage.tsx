import { useEffect, useState, type FormEvent } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import { Button, Card, ErrorBanner, PageHeading, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";

export function AdminSettingsPage() {
  const [cutoffTime, setCutoffTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminApi
      .getSettings()
      .then((s) => setCutoffTime(s.cutoff_time.slice(0, 5)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settings."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cutoffTime) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const updated = await adminApi.updateSettings(`${cutoffTime}:00`);
      setCutoffTime(updated.cutoff_time.slice(0, 5));
      setNotice("Cut-off time updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update settings.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading>School Settings</PageHeading>

      {cutoffTime === null && !error && <LoadingScreen />}

      {cutoffTime !== null && (
        <Card className="max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Daily cut-off time</label>
              <p className="mb-2 text-sm text-gray-500">
                Reservations for the next day can no longer be made or cancelled after this time.
              </p>
              <input
                type="time"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
              />
            </div>

            {error && <ErrorBanner message={error} />}
            {notice && <SuccessBanner message={notice} />}

            <Button type="submit" disabled={submitting} className="self-start">
              {submitting ? "Saving…" : "Save"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
