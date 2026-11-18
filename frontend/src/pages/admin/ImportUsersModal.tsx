import { useState, type FormEvent } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { UserImportResult } from "../../api/types";
import { Button, ErrorBanner, Modal } from "../../components/ui";

const TEMPLATE_CSV = [
  "login_id,email,password,role,name,grade,section,employee_id,department",
  "s.ahmed,s.ahmed@example.com,,student,Sara Ahmed,6,B,,",
  "t.khan,t.khan@example.com,,teacher,Tariq Khan,,,EMP-1042,Science",
  "c.lopez,c.lopez@example.com,,canteen_staff,,,,,",
].join("\n");

function saveCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ImportUsersModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UserImportResult | null>(null);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const res = await adminApi.importUsers(file);
      setResult(res);
      if (res.created.length > 0) onImported(res.created.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import the file.");
    } finally {
      setUploading(false);
    }
  }

  const generated = result?.created.filter((c) => c.temporary_password) ?? [];

  function downloadPasswords() {
    const lines = ["login_id,role,temporary_password"].concat(
      generated.map((c) => [c.login_id, c.role, c.temporary_password ?? ""].map(csvCell).join(",")),
    );
    saveCsv("imported_accounts_passwords.csv", lines.join("\n"));
  }

  return (
    <Modal title="Import accounts" onClose={onClose}>
      {result && result.created.length > 0 ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-700">
            Created {result.created.length} {result.created.length === 1 ? "account" : "accounts"}.
          </p>
          {generated.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              {generated.length} {generated.length === 1 ? "account was" : "accounts were"} given a temporary password.
              Download them now and share them with their owners. They won't be shown again.
            </div>
          )}
          <div className="flex justify-end gap-2">
            {generated.length > 0 && <Button onClick={downloadPasswords}>Download passwords</Button>}
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void handleUpload(e)} className="flex flex-col gap-3 text-sm">
          <p className="text-gray-600">
            Upload a <span className="font-medium">.csv</span> or <span className="font-medium">.xlsx</span> file
            with one account per row. Required columns: <code>login_id</code>, <code>email</code>,{" "}
            <code>role</code> (student, teacher or canteen_staff). Students also need <code>name</code>,{" "}
            <code>grade</code> and <code>section</code>; teachers need <code>name</code> and{" "}
            <code>employee_id</code> (<code>department</code> is optional). Leave <code>password</code> blank to
            generate one.
          </p>
          <button
            type="button"
            className="self-start text-brand-blue hover:underline"
            onClick={() => saveCsv("accounts_template.csv", TEMPLATE_CSV)}
          >
            Download template
          </button>

          <input
            type="file"
            accept=".csv,.xlsx"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-100"
          />

          {error && <ErrorBanner message={error} />}

          {result && result.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              <p className="mb-1 font-medium">
                Nothing was imported. Fix {result.errors.length === 1 ? "this row" : "these rows"} and upload again:
              </p>
              <ul className="max-h-48 list-disc overflow-y-auto pl-5">
                {result.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" disabled={!file || uploading}>
            {uploading ? "Importing…" : "Import"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
