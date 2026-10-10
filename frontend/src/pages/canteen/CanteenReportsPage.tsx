import { useState } from "react";
import { canteenApi } from "../../api/canteen";
import { ApiError } from "../../api/client";
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui";
import { todayISODate } from "../../utils/date";

export function CanteenReportsPage() {
  const [dailyDate, setDailyDate] = useState(todayISODate());
  const [weeklyStart, setWeeklyStart] = useState(todayISODate());
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"daily" | "weekly" | null>(null);

  async function handleDaily() {
    setError(null);
    setDownloading("daily");
    try {
      await canteenApi.downloadDailyReport(dailyDate);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleWeekly() {
    setError(null);
    setDownloading("weekly");
    try {
      await canteenApi.downloadWeeklyReport(weeklyStart);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeading>Reports</PageHeading>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium text-gray-900">Daily report</h2>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Date</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <Button onClick={() => void handleDaily()} disabled={downloading === "daily"}>
              {downloading === "daily" ? "Downloading…" : "Download CSV"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium text-gray-900">Weekly report</h2>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Week starting</label>
              <input
                type="date"
                value={weeklyStart}
                onChange={(e) => setWeeklyStart(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <Button onClick={() => void handleWeekly()} disabled={downloading === "weekly"}>
              {downloading === "weekly" ? "Downloading…" : "Download CSV"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
