import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { AdminReservation, ReservationStatus } from "../../api/types";
import { Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { daysAgoISODate, todayISODate } from "../../utils/date";
import { formatAED } from "../../utils/money";
import { STATUS_LABELS, STATUS_STYLES } from "../../utils/reservationStatus";

export function AdminReservationsPage() {
  // Default to the past week, today included.
  const [startDate, setStartDate] = useState(daysAgoISODate(6));
  const [endDate, setEndDate] = useState(todayISODate());
  const [status, setStatus] = useState<ReservationStatus | "">("");
  const [reservations, setReservations] = useState<AdminReservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(start: string, end: string, forStatus: ReservationStatus | "") {
    setReservations(null);
    setError(null);
    try {
      setReservations(
        await adminApi.listReservations({ start_date: start, end_date: end, status: forStatus || undefined }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reservations.");
    }
  }

  useEffect(() => {
    if (startDate && endDate) void load(startDate, endDate, status);
  }, [startDate, endDate, status]);

  const countFor = (s: ReservationStatus) => reservations?.filter((r) => r.status === s).length ?? 0;
  const inputClasses = "rounded-md border border-gray-300 px-2 py-1 text-sm";

  return (
    <div>
      <PageHeading subtitle="Every reservation made in the chosen dates, with when it was made and how staff handled it.">
        Reservations
      </PageHeading>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          Reserved from
          <input type="date" className={inputClasses} value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          to
          <input type="date" className={inputClasses} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          Status
          <select className={inputClasses} value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus | "")}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABELS) as ReservationStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {reservations === null && !error && <LoadingScreen />}

      {reservations && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Reservations", value: reservations.length },
              { label: "Accepted or later", value: countFor("accepted") + countFor("prepared") + countFor("collected") },
              { label: "Rejected", value: countFor("rejected") },
              { label: "Awaiting acceptance", value: countFor("reserved") },
            ].map((tile) => (
              <Card key={tile.label}>
                <p className="text-xs text-gray-500">{tile.label}</p>
                <p className="text-xl font-semibold tabular-nums text-brand-navy">{tile.value}</p>
              </Card>
            ))}
          </div>

          {reservations.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No reservations in this period.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Reserved at</th>
                    <th className="px-3 py-2 font-medium">Ordered by</th>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Pickup</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Handled by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reservations.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">
                        {new Date(r.reserved_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-900">
                          {r.customer_name}
                          {r.customer_type === "teacher" && (
                            <span className="ml-1.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                              Teacher
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{r.customer_detail}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-900">
                          {r.quantity} × {r.menu_item_name}
                        </p>
                        <p className="text-xs tabular-nums text-gray-500">{formatAED(r.quantity * r.unit_price)}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">{r.pickup_date}</td>
                      <td className="px-3 py-2">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                        {r.status === "rejected" && (
                          <p className="mt-1 max-w-xs text-xs text-red-700">
                            {r.rejection_reason ? `"${r.rejection_reason}"` : "No note given"}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.reviewed_by_login_id ? (
                          <>
                            <p className="text-gray-700">{r.reviewed_by_login_id}</p>
                            {r.reviewed_at && <p>{new Date(r.reviewed_at).toLocaleString()}</p>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
