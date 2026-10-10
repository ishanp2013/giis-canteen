import { useEffect, useState } from "react";
import { adminApi } from "../../api/admin";
import { ApiError } from "../../api/client";
import type { Analytics } from "../../api/types";
import { Card, ErrorBanner, PageHeading } from "../../components/ui";
import { LoadingScreen } from "../../components/LoadingScreen";

export function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getAnalytics()
      .then(setAnalytics)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load analytics."));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (analytics === null) return <LoadingScreen />;

  return (
    <div>
      <PageHeading>Analytics</PageHeading>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Active reservations</p>
          <p className="text-2xl font-semibold text-gray-900">{analytics.total_reservations}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Cancelled reservations</p>
          <p className="text-2xl font-semibold text-gray-900">{analytics.total_cancelled}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Waste avoided (meals)</p>
          <p className="text-2xl font-semibold text-gray-900">{analytics.waste_avoided}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-medium text-gray-900">Popular items</h2>
        {analytics.popular_items.length === 0 && <p className="text-sm text-gray-500">No reservations yet.</p>}
        <ul className="flex flex-col gap-1">
          {analytics.popular_items.map((item) => (
            <li key={item.menu_item_name} className="flex justify-between text-sm text-gray-700">
              <span>{item.menu_item_name}</span>
              <span className="font-medium">{item.reservation_count}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
