import { useEffect, useState, type FormEvent } from "react";
import { feedbackApi } from "../api/feedback";
import { ApiError } from "../api/client";
import type { Feedback, FeedbackCategory } from "../api/types";
import { Button, Card, ErrorBanner, PageHeading, SuccessBanner } from "../components/ui";

// Shared by the student and canteen staff portals.
export function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sent, setSent] = useState<Feedback[] | null>(null);

  async function load() {
    try {
      setSent(await feedbackApi.getMine());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load your messages.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await feedbackApi.submit({ category, subject: subject.trim(), message: message.trim() });
      setSuccess(`Your ${category} was sent to the school admins.`);
      setSubject("");
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send your message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeading subtitle="Send a suggestion or complaint to the school admins.">Feedback</PageHeading>

      <div className="mb-4 flex flex-col gap-2">
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}
      </div>

      <Card className="mb-6">
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <div className="flex gap-4 text-sm text-gray-700">
            {(["suggestion", "complaint"] as const).map((c) => (
              <label key={c} className="flex items-center gap-1.5 capitalize">
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                />
                {c}
              </label>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">Subject</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              maxLength={200}
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">Message</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={5}
              maxLength={5000}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div>
            <Button type="submit" disabled={submitting || !subject.trim() || !message.trim()}>
              {submitting ? "Sending…" : "Send to admins"}
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="mb-3 font-semibold text-brand-navy">Sent messages</h2>
      {sent === null && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {sent?.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">You haven't sent any suggestions or complaints yet.</p>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {sent?.map((f) => (
          <Card key={f.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-gray-900">
                <span className="capitalize text-gray-500">{f.category}:</span> {f.subject}
              </p>
              <FeedbackStatusBadge status={f.status} />
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{f.message}</p>
            <p className="mt-1 text-xs text-gray-400">{new Date(f.created_at).toLocaleString()}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FeedbackStatusBadge({ status }: { status: Feedback["status"] }) {
  const style = status === "open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{status}</span>;
}
