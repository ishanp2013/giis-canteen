import { useEffect, useState } from "react";
import { studentApi } from "../../api/student";
import { ApiError } from "../../api/client";
import type { Availability } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";

export function StudentMenuPage() {
  const [items, setItems] = useState<Availability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reservingId, setReservingId] = useState<number | null>(null);

  async function loadMenu() {
    try {
      setItems(await studentApi.getMenu());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load menu.");
    }
  }

  useEffect(() => {
    void loadMenu();
  }, []);

  async function handleReserve(item: Availability) {
    setError(null);
    setSuccess(null);
    setReservingId(item.id);
    try {
      await studentApi.reserve(item.id);
      setSuccess(`Reserved "${item.menu_item_name}" for tomorrow (${item.available_date}). See it under My Reservations.`);
      await loadMenu();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reserve this item.");
    } finally {
      setReservingId(null);
    }
  }

  if (items === null && !error) return <LoadingScreen />;

  return (
    <div>
      <PageHeading>Tomorrow's Menu</PageHeading>

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
              <h2 className="font-medium text-gray-900">{item.menu_item_name}</h2>
              {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
            </div>
            <p className="text-sm text-gray-600">
              {item.remaining_availability > 0
                ? `${item.remaining_availability} left`
                : "Fully booked"}
            </p>
            <Button
              onClick={() => void handleReserve(item)}
              disabled={item.remaining_availability <= 0 || reservingId === item.id}
              className="self-start"
            >
              {reservingId === item.id ? "Reserving…" : "Reserve"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
