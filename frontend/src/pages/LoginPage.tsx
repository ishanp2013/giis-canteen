import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { Button, ErrorBanner } from "../components/ui";

export function LoginPage() {
  const { user, login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginId, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-navy via-[#0b3660] to-brand-blue px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" alt="GIIS" className="h-12 w-auto rounded-lg bg-white/95 px-3 py-2 shadow-lg" />
          <div>
            <h1 className="text-lg font-semibold text-white">GIIS Canteen</h1>
            <p className="text-sm text-white/70">Pre-Order &amp; Reservation System</p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-2xl">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Sign in</h2>
          <p className="mb-5 text-sm text-gray-500">Use the account provided by your school.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Login ID</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <ErrorBanner message={error} />}

            <Button type="submit" disabled={submitting} className="mt-1 w-full py-2">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          GIIS Canteen Pre-Order &amp; Reservation System · v1.0
        </p>
      </div>
    </div>
  );
}
