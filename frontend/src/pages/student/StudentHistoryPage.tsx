import { useEffect, useState } from "react";
import { studentApi } from "../../api/student";
import { ApiError } from "../../api/client";
import type { Availability, Reservation, ReservationStatus } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading, QuantityStepper } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { formatAED } from "../../utils/money";

const STATUS_STYLES: Record<ReservationStatus, string> = {
  reserved: "bg-blue-50 text-blue-700",
  prepared: "bg-amber-50 text-amber-700",
  collected: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function StudentHistoryPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [menu, setMenu] = useState<Availability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [draftQuantities, setDraftQuantities] = useState<Record<number, number>>({});

  async function load() {
    try {
      const [mine, tomorrow] = await Promise.all([studentApi.getMyReservations(), studentApi.getMenu()]);
      setReservations(mine);
      setMenu(tomorrow);
      setDraftQuantities({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reservation history.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Only tomorrow's reservations appear in the menu, so this also decides which ones are still editable.
  function maxQuantityFor(r: Reservation): number | null {
    const entry = menu.find((m) => m.id === r.availability_id);
    return entry ? entry.remaining_availability + r.quantity : null;
  }

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

  async function handleSaveQuantity(id: number, quantity: number) {
    setError(null);
    setSavingId(id);
    try {
      await studentApi.updateQuantity(id, quantity);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update quantity.");
    } finally {
      setSavingId(null);
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
        {reservations?.map((r) => {
          const maxQuantity = r.status === "reserved" ? maxQuantityFor(r) : null;
          const draft = draftQuantities[r.id] ?? r.quantity;
          const busy = cancellingId === r.id || savingId === r.id;
          return (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">
                  {r.quantity} × {r.menu_item_name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatAED(r.unit_price)} each · Total{" "}
                  <span className="font-medium tabular-nums text-gray-900">{formatAED(r.unit_price * draft)}</span>
                </p>
                <p className="text-sm text-gray-500">Pickup: {r.pickup_date}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {maxQuantity !== null && (
                  <>
                    <QuantityStepper
                      value={draft}
                      max={maxQuantity}
                      disabled={busy}
                      onChange={(q) => setDraftQuantities((prev) => ({ ...prev, [r.id]: q }))}
                    />
                    {draft !== r.quantity && (
                      <Button disabled={busy} onClick={() => void handleSaveQuantity(r.id, draft)}>
                        {savingId === r.id ? "Saving…" : "Save"}
                      </Button>
                    )}
                  </>
                )}
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
                {r.status === "reserved" && (
                  <Button variant="danger" disabled={busy} onClick={() => void handleCancel(r.id)}>
                    {cancellingId === r.id ? "Cancelling…" : "Cancel"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
