import { useEffect, useState, type FormEvent } from "react";
import { canteenApi, type MenuItemInput } from "../../api/canteen";
import { ApiError } from "../../api/client";
import type { MenuItem } from "../../api/types";
import { Button, Card, ErrorBanner, Modal, PageHeading, SuccessBanner } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";
import { IconEdit } from "../../components/icons";
import { formatAED } from "../../utils/money";

// The price is kept as text while typing, so a half-typed value like "12." isn't reformatted.
type MenuItemForm = { name: string; description: string; price: string };

const emptyForm: MenuItemForm = { name: "", description: "", price: "" };

function toInput(form: MenuItemForm): MenuItemInput {
  return { name: form.name, description: form.description, price: Number(form.price) };
}

export function CanteenMenuPage() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<MenuItemForm>(emptyForm);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editForm, setEditForm] = useState<MenuItemForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setItems(null);
    try {
      setItems(await canteenApi.listMenuItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load menu items.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openEdit(item: MenuItem) {
    setEditingItem(item);
    setEditForm({ name: item.name, description: item.description ?? "", price: item.price.toFixed(2) });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await canteenApi.createMenuItem(toInput(form));
      setShowAddModal(false);
      setForm(emptyForm);
      setNotice(`"${form.name}" added to the catalog.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create menu item.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await canteenApi.updateMenuItem(editingItem.id, toInput(editForm));
      setEditingItem(null);
      setNotice(`"${editForm.name}" updated.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update menu item.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: MenuItem) {
    setError(null);
    try {
      await canteenApi.deleteMenuItem(item.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete menu item.");
    }
  }

  function renderFormFields(value: MenuItemForm, onChange: (v: MenuItemForm) => void) {
    return (
      <>
        <div>
          <label className="mb-1 block text-sm text-gray-700">Name</label>
          <input
            required
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700">Description</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-700">Price (AED)</label>
          <input
            required
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeading
        subtitle="The dishes your canteen can serve. Set day-by-day quantities on the Availability page."
        action={<Button onClick={() => setShowAddModal(true)}>+ Add menu item</Button>}
      >
        Menu Items
      </PageHeading>

      <div className="mb-4 flex flex-col gap-2">
        {error && <ErrorBanner message={error} />}
        {notice && <SuccessBanner message={notice} />}
      </div>

      <Card className="overflow-hidden p-0">
        {items === null && (
          <div className="p-4">
            <LoadingScreen />
          </div>
        )}
        {items?.length === 0 && <p className="p-4 text-sm text-gray-500">No menu items yet.</p>}
        {items && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Description</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Price</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{item.description || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-900">
                      {formatAED(item.price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" title="Edit item" onClick={() => openEdit(item)}>
                          <IconEdit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="danger" onClick={() => void handleDelete(item)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAddModal && (
        <Modal title="Add menu item" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            {renderFormFields(form, setForm)}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add item"}
            </Button>
          </form>
        </Modal>
      )}

      {editingItem && (
        <Modal title={`Edit ${editingItem.name}`} onClose={() => setEditingItem(null)}>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
            {renderFormFields(editForm, setEditForm)}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
