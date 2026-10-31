import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { studentApi } from "../../api/student";
import { ApiError } from "../../api/client";
import type { Availability, Reservation } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading, QuantityStepper, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { formatAED } from "../../utils/money";

export function StudentMenuPage() {
  const [items, setItems] = useState<Availability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The basket: portions picked per availability id. Dishes left at 0 aren't ordered.
  const [basket, setBasket] = useState<Record<number, number>>({});
  // Active reservations keyed by availability id, so each dish can show what's already held.
  const [held, setHeld] = useState<Record<number, Reservation>>({});

  async function loadMenu() {
    try {
      const [menu, mine] = await Promise.all([studentApi.getMenu(), studentApi.getMyReservations()]);
      setItems(menu);
      setHeld(
        Object.fromEntries(mine.filter((r) => r.status !== "cancelled").map((r) => [r.availability_id, r])),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load menu.");
    }
  }

  useEffect(() => {
    void loadMenu();
  }, []);

  // Clamp to what's left, in case availability dropped since the student picked a number.
  function quantityFor(item: Availability) {
    return Math.min(basket[item.id] ?? 0, Math.max(item.remaining_availability, 0));
  }

  const picked = (items ?? [])
    .map((item) => ({ item, quantity: quantityFor(item) }))
    .filter(({ quantity }) => quantity > 0);
  const totalPortions = picked.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = picked.reduce((sum, p) => sum + p.quantity * p.item.price, 0);

  async function handleReserveAll() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await studentApi.reserveMany(picked.map(({ item, quantity }) => ({ availability_id: item.id, quantity })));
      const summary = picked.map(({ item, quantity }) => `${quantity} × ${item.menu_item_name}`).join(", ");
      setSuccess(`Reserved ${summary} for tomorrow (${formatAED(totalPrice)}). See it under My Reservations.`);
      setBasket({});
      await loadMenu();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reserve your order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items === null && !error) return <LoadingScreen />;

  return (
    <div className={picked.length > 0 ? "pb-24" : ""}>
      <PageHeading subtitle="Pick how many of each dish you want, then reserve them all at once.">
        Tomorrow's Menu
      </PageHeading>

      <div className="mb-4 flex flex-col gap-2">
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}
      </div>

      {items && items.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">No menu has been published for tomorrow yet. Check back later.</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items?.map((item) => (
          <Card key={item.id} className="flex flex-col gap-2">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium text-gray-900">{item.menu_item_name}</h2>
                <span className="shrink-0 font-semibold tabular-nums text-brand-navy">{formatAED(item.price)}</span>
              </div>
              {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
            </div>
            <p className="text-sm text-gray-600">
              {item.remaining_availability > 0
                ? `${item.remaining_availability} left`
                : "Fully booked"}
            </p>
            {held[item.id] && (
              <p className="text-sm">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  You've reserved {held[item.id].quantity}
                </span>{" "}
                <Link to="/student/history" className="text-brand-blue hover:underline">
                  Manage
                </Link>
              </p>
            )}
            {item.remaining_availability > 0 && (!held[item.id] || held[item.id].status === "reserved") && (
              <div className="flex items-center gap-3">
                <QuantityStepper
                  value={quantityFor(item)}
                  min={0}
                  max={item.remaining_availability}
                  disabled={submitting}
                  onChange={(q) => setBasket((prev) => ({ ...prev, [item.id]: q }))}
                />
                {held[item.id] && <span className="text-xs text-gray-500">adds to your reservation</span>}
              </div>
            )}
          </Card>
        ))}
      </div>

      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">Your order:</span>{" "}
              {picked.map(({ item, quantity }) => `${quantity} × ${item.menu_item_name}`).join(", ")}
              <span className="ml-2 font-semibold tabular-nums text-gray-900">Total {formatAED(totalPrice)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={submitting} onClick={() => setBasket({})}>
                Clear
              </Button>
              <Button disabled={submitting} onClick={() => void handleReserveAll()}>
                {submitting
                  ? "Reserving…"
                  : `Reserve ${totalPortions} ${totalPortions === 1 ? "portion" : "portions"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
