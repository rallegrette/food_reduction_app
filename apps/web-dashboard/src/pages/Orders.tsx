import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getRestaurantForOwner } from "../lib/restaurant";

type OrderRow = {
  id: string;
  deal_type: "regular" | "mystery";
  status: string;
  total_amount: number;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  created_at: string;
};

export default function Orders({ ownerUserId }: { ownerUserId: string }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  async function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: ordErr } = await supabase
        .from("orders")
        .select("id,deal_type,status,total_amount,pickup_window_start,pickup_window_end,created_at")
        .eq("restaurant_id", restaurantId)
        .in("status", ["reserved"]);
      if (ordErr) throw ordErr;
      setOrders((data ?? []).map((o: any) => ({
        id: String(o.id),
        deal_type: o.deal_type,
        status: String(o.status),
        total_amount: Number(o.total_amount),
        pickup_window_start: o.pickup_window_start ? String(o.pickup_window_start) : null,
        pickup_window_end: o.pickup_window_end ? String(o.pickup_window_end) : null,
        created_at: String(o.created_at),
      })));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getRestaurantForOwner(ownerUserId);
        if (!mounted) return;
        setRestaurantId(r ? String(r.id) : null);
      } catch (e) {
        if (!mounted) return;
        setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ownerUserId]);

  useEffect(() => {
    if (restaurantId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function accept(orderId: string) {
    if (!restaurantId) return;
    setError(null);
    const { error: fnErr } = await supabase.functions.invoke("restaurant_accept_order", {
      body: { order_id: orderId, restaurant_id: restaurantId },
    });
    if (fnErr) setError(String(fnErr));
    await refresh();
  }

  async function reject(orderId: string) {
    if (!restaurantId) return;
    setError(null);
    const { error: fnErr } = await supabase.functions.invoke("restaurant_reject_order", {
      body: { order_id: orderId, restaurant_id: restaurantId },
    });
    if (fnErr) setError(String(fnErr));
    await refresh();
  }

  if (loading) return <div>Loading...</div>;
  if (!restaurantId) return <div>Create your restaurant first in Onboarding.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>Orders to Accept (Reserved)</h2>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={refresh}>Refresh</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Order</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Type</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Total</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Pickup Window</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{o.id.slice(0, 8)}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{new Date(o.created_at).toLocaleString()}</div>
                </td>
                <td style={{ padding: 8 }}>{o.deal_type}</td>
                <td style={{ padding: 8 }}>${o.total_amount.toFixed(2)}</td>
                <td style={{ padding: 8, fontSize: 12, color: "#555" }}>
                  {o.pickup_window_start ? new Date(o.pickup_window_start).toLocaleTimeString() : "—"} to{" "}
                  {o.pickup_window_end ? new Date(o.pickup_window_end).toLocaleTimeString() : "—"}
                </td>
                <td style={{ padding: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => accept(o.id)}>Accept</button>
                  <button onClick={() => reject(o.id)}>Reject</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16 }}>
                  No reserved orders right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

