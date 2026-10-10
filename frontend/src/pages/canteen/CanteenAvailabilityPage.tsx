import { useEffect, useState, type FormEvent } from "react";
import { canteenApi } from "../../api/canteen";
import { ApiError } from "../../api/client";
import type { Availability, MenuItem } from "../../api/types";
import { Button, Card, ErrorBanner, Modal, PageHeading, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { tomorrowISODate } from "../../utils/date";

export function CanteenAvailabilityPage() {
  const [date, setDate] = useState(tomorrowISODate());
  const [entries, setEntries] = useState<Availability[] | null>(null);
  const [catalog, setCatalog] = useState<MenuItem[] | null>(null);
  const [edited, setEdited] = useState<Record<number, number>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMenuItemId, setNewMenuItemId] = useState<number | "">("");
  const [newDate, setNewDate] = useState(date);
  const [newQuantity, setNewQuantity] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  async function load(forDate: string) {
    setEntries(null);
    setEdited({});
    try {
      setEntries(await canteenApi.listAvailability(forDate));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load availability.");
    }
  }

  useEffect(() => {
    void load(date);
  }, [date]);

  useEffect(() => {
    canteenApi
      .listMenuItems()
      .then(setCatalog)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load menu items."));
  }, []);

  function openAddModal() {
    setNewDate(date);
    setNewMenuItemId(catalog?.[0]?.id ?? "");
    setNewQuantity(10);
    setShowAddModal(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (newMenuItemId === "") return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await canteenApi.createAvailability({
        menu_item_id: newMenuItemId,
        available_date: newDate,
        quantity_available: newQuantity,
      });
      setShowAddModal(false);
      setNotice(`Availability added for ${newDate}.`);
      if (newDate === date) {
        await load(date);
      } else {
        setDate(newDate);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add availability.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave(entry: Availability) {
    const newQty = edited[entry.id];
    if (newQty === undefined || newQty === entry.quantity_available) return;

    setError(null);
    setNotice(null);
    setSavingId(entry.id);
    try {
      await canteenApi.updateAvailability(entry.id, newQty);
      setNotice(`"${entry.menu_item_name}" is now set to ${newQty} available for ${date}.`);
      await load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update availability.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(entry: Availability) {
    setError(null);
    try {
      await canteenApi.deleteAvailability(entry.id);
      await load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove availability entry.");
    }
  }

  return (
    <div>
      <PageHeading
        subtitle="Pick a date, choose a menu item, and set how many are available for students to reserve."
        action={<Button onClick={openAddModal}>+ Add availability</Button>}
      >
        Availability
      </PageHeading>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-gray-600">Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {error && <ErrorBanner message={error} />}
        {notice && <SuccessBanner message={notice} />}
      </div>

      <Card className="overflow-hidden p-0">
        {entries === null && (
          <div className="p-4">
            <LoadingScreen />
          </div>
        )}

        {entries?.length === 0 && (
          <p className="p-4 text-sm text-gray-500">
            Nothing set for this date yet. Click <span className="font-medium">+ Add availability</span> to offer a menu item.
          </p>
        )}

        {entries && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Reserved</th>
                  <th className="whitespace-nowrap px-4 py-3">Available</th>
                  <th className="whitespace-nowrap px-4 py-3">Remaining</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => {
                  const reserved = entry.quantity_available - entry.remaining_availability;
                  const value = edited[entry.id] ?? entry.quantity_available;
                  const remaining = value - reserved;
                  const dirty = value !== entry.quantity_available;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                        {entry.menu_item_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{reserved}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <input
                          type="number"
                          min={reserved}
                          value={value}
                          onChange={(e) =>
                            setEdited({ ...edited, [entry.id]: Math.max(reserved, Number(e.target.value)) })
                          }
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            remaining > 0 ? "bg-brand-green/15 text-green-800" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {remaining} left
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant={dirty ? "primary" : "secondary"}
                            disabled={!dirty || savingId === entry.id}
                            onClick={() => void handleSave(entry)}
                          >
                            {savingId === entry.id ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={reserved > 0}
                            title={reserved > 0 ? "Can't remove — it already has reservations" : "Remove"}
                            onClick={() => void handleDelete(entry)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAddModal && (
        <Modal title="Add availability" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Menu item</label>
              <select
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={newMenuItemId}
                onChange={(e) => setNewMenuItemId(Number(e.target.value))}
              >
                <option value="" disabled>
                  Select a menu item…
                </option>
                {catalog?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {catalog?.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  No menu items yet — add one on the Menu Items page first.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Date</label>
              <input
                type="date"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Quantity available</label>
              <input
                type="number"
                min={0}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
              />
            </div>
            <Button type="submit" disabled={submitting || newMenuItemId === ""}>
              {submitting ? "Adding…" : "Add availability"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
