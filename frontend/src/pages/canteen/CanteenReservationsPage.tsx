import { useEffect, useState, type FormEvent } from "react";
import { canteenApi } from "../../api/canteen";
import { ApiError } from "../../api/client";
import type { ReservationCount, ReservationStatus, StaffReservation } from "../../api/types";
import { Button, Card, ErrorBanner, Modal, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { tomorrowISODate } from "../../utils/date";
import { formatAED } from "../../utils/money";
import { STATUS_LABELS, STATUS_STYLES } from "../../utils/reservationStatus";

export function CanteenReservationsPage() {
  const [date, setDate] = useState(tomorrowISODate());
  const [reservations, setReservations] = useState<StaffReservation[] | null>(null);
  const [summary, setSummary] = useState<ReservationCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  // The reservation being rejected, while staff write an optional note to the student.
  const [rejecting, setRejecting] = useState<StaffReservation | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

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

  async function handleStatusChange(id: number, status: ReservationStatus, reason?: string) {
    setError(null);
    setUpdatingId(id);
    try {
      await canteenApi.updateReservationStatus(id, status, reason);
      await load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update reservation.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openReject(r: StaffReservation) {
    setRejecting(r);
    setRejectionReason("");
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    const id = rejecting.id;
    setRejecting(null);
    await handleStatusChange(id, "rejected", rejectionReason.trim() || undefined);
  }

  const totalReserved = summary?.reduce((sum, s) => sum + s.reserved_count, 0) ?? 0;
  const awaiting = reservations?.filter((r) => r.status === "reserved").length ?? 0;

  return (
    <div>
      <PageHeading subtitle="Accept or reject each new order, then mark it prepared and collected.">
        Reservations
      </PageHeading>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-gray-600">Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        {awaiting > 0 && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {awaiting} awaiting acceptance
          </span>
        )}
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
        {reservations?.map((r) => {
          const busy = updatingId === r.id;
          return (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">
                  {r.quantity} × {r.menu_item_name} — {r.customer_name}
                  {r.customer_type === "teacher" && (
                    <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      Teacher
                    </span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {formatAED(r.quantity * r.unit_price)} · ordered {new Date(r.reserved_at).toLocaleString()}
                </p>
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-1 text-sm text-red-700">Note sent: "{r.rejection_reason}"</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status === "reserved" && (
                  <Button disabled={busy} onClick={() => void handleStatusChange(r.id, "accepted")}>
                    Accept
                  </Button>
                )}
                {(r.status === "reserved" || r.status === "accepted") && (
                  <Button variant="danger" disabled={busy} onClick={() => openReject(r)}>
                    Reject
                  </Button>
                )}
                {r.status === "accepted" && (
                  <Button variant="secondary" disabled={busy} onClick={() => void handleStatusChange(r.id, "prepared")}>
                    Mark prepared
                  </Button>
                )}
                {r.status === "prepared" && (
                  <Button disabled={busy} onClick={() => void handleStatusChange(r.id, "collected")}>
                    Mark collected
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {rejecting && (
        <Modal title="Reject reservation" onClose={() => setRejecting(null)}>
          <form onSubmit={(e) => void handleReject(e)} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              {rejecting.quantity} × {rejecting.menu_item_name} for {rejecting.customer_name}. The portions go back
              on sale and they see your note.
            </p>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Note to the {rejecting.customer_type} (optional)</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                maxLength={500}
                placeholder="e.g. Sorry, we ran out of rice for tomorrow."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
                Back
              </Button>
              <Button type="submit" variant="danger">
                Reject reservation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
