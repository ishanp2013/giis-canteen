import { useEffect, useState, type FormEvent } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { AuditLog } from "../../api/types";
import { Button, Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";

export function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(filterAction?: string) {
    setLogs(null);
    try {
      setLogs(await adminApi.getLogs(filterAction ? { action: filterAction } : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit log.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    void load(action || undefined);
  }

  return (
    <div>
      <PageHeading>Audit Log</PageHeading>

      <form onSubmit={handleFilter} className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm text-gray-700">Filter by action</label>
          <input
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="e.g. login_success"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {logs === null && !error && <LoadingScreen />}

      <div className="flex flex-col gap-2">
        {logs?.length === 0 && (
          <Card>
            <p className="text-sm text-gray-500">No matching log entries.</p>
          </Card>
        )}
        {logs?.map((log) => (
          <Card key={log.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-900">{log.action}</span>
            <span className="text-gray-500">user #{log.user_id}</span>
            <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
            {log.metadata_json && (
              <span className="w-full text-xs text-gray-400">{JSON.stringify(log.metadata_json)}</span>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
