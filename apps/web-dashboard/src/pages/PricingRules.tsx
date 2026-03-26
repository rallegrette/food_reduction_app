import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getRestaurantForOwner } from "../lib/restaurant";

type MenuItem = { id: string; name: string; category: string };
type PricingRule = {
  id: string;
  target_scope: "item" | "category" | "all";
  target_menu_item_id: string | null;
  target_category: string | null;
  applies_after_time: string;
  discount_percent: number;
  stop_discount_if_sold_through_gte_percent: number | null;
  enabled: boolean;
};

export default function PricingRules({ ownerUserId }: { ownerUserId: string }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);

  const [targetScope, setTargetScope] = useState<"item" | "category" | "all">("item");
  const [targetMenuItemId, setTargetMenuItemId] = useState<string>("");
  const [targetCategory, setTargetCategory] = useState<string>("");
  const [appliesAfterTime, setAppliesAfterTime] = useState<string>("20:00");
  const [discountPercent, setDiscountPercent] = useState<string>("20");
  const [stopGteSoldThroughPercent, setStopGteSoldThroughPercent] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  async function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: items, error: itemsErr } = await supabase
        .from("menu_items")
        .select("id,name,category")
        .eq("restaurant_id", restaurantId);
      if (itemsErr) throw itemsErr;
      setMenuItems((items ?? []).map((i: any) => ({ id: String(i.id), name: String(i.name), category: String(i.category) })));

      const { data: rulesRows, error: rulesErr } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("restaurant_id", restaurantId);
      if (rulesErr) throw rulesErr;

      setRules((rulesRows ?? []).map((r: any) => ({
        id: String(r.id),
        target_scope: r.target_scope,
        target_menu_item_id: r.target_menu_item_id ? String(r.target_menu_item_id) : null,
        target_category: r.target_category ? String(r.target_category) : null,
        applies_after_time: String(r.applies_after_time),
        discount_percent: Number(r.discount_percent),
        stop_discount_if_sold_through_gte_percent: r.stop_discount_if_sold_through_gte_percent == null ? null : Number(r.stop_discount_if_sold_through_gte_percent),
        enabled: !!r.enabled,
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

  useEffect(() => {
    if (targetScope === "item") {
      const first = menuItems[0]?.id ?? "";
      setTargetMenuItemId(first);
    }
    if (targetScope === "category") {
      const cat = menuItems[0]?.category ?? "";
      setTargetCategory(cat);
    }
  }, [targetScope]); // intentionally not depending on menuItems

  async function addRule() {
    if (!restaurantId) return;
    setError(null);

    const discount = Number(discountPercent);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setError("discount_percent must be between 0 and 100");
      return;
    }

    const stopVal = stopGteSoldThroughPercent.trim() === "" ? null : Number(stopGteSoldThroughPercent);
    if (stopVal != null && (!Number.isFinite(stopVal) || stopVal < 0 || stopVal > 100)) {
      setError("stop_discount_if_sold_through_gte_percent must be between 0 and 100");
      return;
    }

    const payload: any = {
      restaurant_id: restaurantId,
      enabled,
      target_scope: targetScope,
      applies_after_time: appliesAfterTime,
      discount_percent: discount,
      stop_discount_if_sold_through_gte_percent: stopVal,
    };

    if (targetScope === "item") payload.target_menu_item_id = targetMenuItemId;
    if (targetScope === "category") payload.target_category = targetCategory;

    const { error: insErr } = await supabase.from("pricing_rules").insert(payload);
    if (insErr) {
      setError(String(insErr));
      return;
    }
    await refresh();
  }

  async function toggleEnabled(ruleId: string, nextEnabled: boolean) {
    if (!restaurantId) return;
    const { error: upErr } = await supabase.from("pricing_rules").update({ enabled: nextEnabled }).eq("id", ruleId);
    if (upErr) setError(String(upErr));
    await refresh();
  }

  async function deleteRule(ruleId: string) {
    if (!restaurantId) return;
    const { error: delErr } = await supabase.from("pricing_rules").delete().eq("id", ruleId);
    if (delErr) setError(String(delErr));
    await refresh();
  }

  if (loading) return <div>Loading...</div>;
  if (!restaurantId) return <div>Create your restaurant first in Onboarding.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>Pricing Rules</h2>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <h3>Add Rule</h3>
        <label>
          Target scope
          <select value={targetScope} onChange={(e) => setTargetScope(e.target.value as any)} style={{ padding: 10, marginLeft: 8 }}>
            <option value="item">Item</option>
            <option value="category">Category</option>
            <option value="all">All</option>
          </select>
        </label>

        {targetScope === "item" ? (
          <label>
            Menu item
            <select value={targetMenuItemId} onChange={(e) => setTargetMenuItemId(e.target.value)} style={{ padding: 10, marginLeft: 8 }}>
              {menuItems.map((mi) => (
                <option key={mi.id} value={mi.id}>
                  {mi.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {targetScope === "category" ? (
          <label>
            Category
            <input value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} style={{ padding: 10, marginLeft: 8 }} />
          </label>
        ) : null}

        <label>
          Applies after time
          <input type="time" value={appliesAfterTime} onChange={(e) => setAppliesAfterTime(e.target.value)} style={{ padding: 10, marginLeft: 8 }} />
        </label>

        <label>
          Discount %
          <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} step="0.01" style={{ padding: 10, marginLeft: 8, width: 140 }} />
        </label>

        <label>
          Stop discount when sold-through is at least %
          <input
            type="number"
            value={stopGteSoldThroughPercent}
            onChange={(e) => setStopGteSoldThroughPercent(e.target.value)}
            step="0.01"
            placeholder="optional"
            style={{ padding: 10, marginLeft: 8, width: 200 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>

        <button onClick={addRule} disabled={menuItems.length === 0 && targetScope === "item"}>
          Add Rule
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Scope</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>After</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Discount</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Stop at sold-through</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Enabled</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{r.target_scope}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>
                    {r.target_scope === "item" ? `item_id=${r.target_menu_item_id}` : r.target_scope === "category" ? `category=${r.target_category}` : "all"}
                  </div>
                </td>
                <td style={{ padding: 8 }}>{String(r.applies_after_time).slice(0, 5)}</td>
                <td style={{ padding: 8 }}>{r.discount_percent.toFixed(2)}%</td>
                <td style={{ padding: 8 }}>{r.stop_discount_if_sold_through_gte_percent == null ? "-" : `${r.stop_discount_if_sold_through_gte_percent.toFixed(2)}%`}</td>
                <td style={{ padding: 8 }}>{r.enabled ? "Yes" : "No"}</td>
                <td style={{ padding: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => toggleEnabled(r.id, !r.enabled)}>{r.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => deleteRule(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16 }}>
                  No pricing rules yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

