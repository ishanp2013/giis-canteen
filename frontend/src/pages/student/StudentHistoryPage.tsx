import { useEffect, useState } from "react";
import { studentApi } from "../../api/student";
import { ApiError } from "../../api/client";
import type { Reservation, ReservationStatus } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";

const STATUS_STYLES: Record<ReservationStatus, string> = {
  reserved: "bg-blue-50 text-blue-700",
  prepared: "bg-amber-50 text-amber-700",
  collected: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function StudentHistoryPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function load() {
    try {
      setReservations(await studentApi.getMyReservations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reservation history.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCancel(id: number) {
    setError(null);
    setCancellingId(id);
    try {
      await studentApi.cancelReservation(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel reservation.");
    } finally {
      setCancellingId(null);
    }
  }

  if (reservations === null && !error) return <LoadingScreen />;

  return (
    <div>
      <PageHeading>My Reservations</PageHeading>

      {error && <ErrorBanner message={error} />}

      {reservations && reservations.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">You haven't made any reservations yet.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {reservations?.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">{r.menu_item_name}</p>
              <p className="text-sm text-gray-500">Pickup: {r.pickup_date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                {r.status}
              </span>
              {r.status === "reserved" && (
                <Button
                  variant="danger"
                  disabled={cancellingId === r.id}
                  onClick={() => void handleCancel(r.id)}
                >
                  {cancellingId === r.id ? "Cancelling…" : "Cancel"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
