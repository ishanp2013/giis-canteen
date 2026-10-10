import { useEffect, useState } from "react";
import { canteenApi } from "../../api/canteen";
import { ApiError } from "../../api/client";
import type { ReservationCount, ReservationStatus, StaffReservation } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { tomorrowISODate } from "../../utils/date";

export function CanteenReservationsPage() {
  const [date, setDate] = useState(tomorrowISODate());
  const [reservations, setReservations] = useState<StaffReservation[] | null>(null);
  const [summary, setSummary] = useState<ReservationCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load(forDate: string) {
    setReservations(null);
    setSummary(null);
    try {
      const [res, sum] = await Promise.all([
        canteenApi.listReservations(forDate),
        canteenApi.getSummary(forDate),
      ]);
      setReservations(res);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reservations.");
    }
  }

  useEffect(() => {
    void load(date);
  }, [date]);

  async function handleStatusChange(id: number, status: ReservationStatus) {
    setError(null);
    setUpdatingId(id);
    try {
      await canteenApi.updateReservationStatus(id, status);
      await load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update reservation.");
    } finally {
      setUpdatingId(null);
    }
  }

  const totalReserved = summary?.reduce((sum, s) => sum + s.reserved_count, 0) ?? 0;

  return (
    <div>
      <PageHeading>Reservations</PageHeading>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-gray-600">Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <Card className="mb-4">
        <h2 className="mb-2 font-medium text-gray-900">Preparation counts — total: {totalReserved}</h2>
        {summary === null && <p className="text-sm text-gray-500">Loading…</p>}
        {summary && summary.length === 0 && <p className="text-sm text-gray-500">No menu items for this date.</p>}
        <ul className="flex flex-col gap-1">
          {summary?.map((s) => (
            <li key={s.menu_item_id} className="flex justify-between text-sm text-gray-700">
              <span>{s.menu_item_name}</span>
              <span className="font-medium">{s.reserved_count}</span>
            </li>
          ))}
        </ul>
      </Card>

      {reservations === null && <LoadingScreen />}

      <div className="flex flex-col gap-2">
        {reservations?.length === 0 && (
          <Card>
            <p className="text-sm text-gray-500">No reservations for this date.</p>
          </Card>
        )}
        {reservations?.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">
                {r.menu_item_name} — {r.student_name}
              </p>
              <p className="text-sm text-gray-500">Status: {r.status}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={r.status !== "reserved" || updatingId === r.id}
                onClick={() => void handleStatusChange(r.id, "prepared")}
              >
                Mark prepared
              </Button>
              <Button
                disabled={r.status !== "prepared" || updatingId === r.id}
                onClick={() => void handleStatusChange(r.id, "collected")}
              >
                Mark collected
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
