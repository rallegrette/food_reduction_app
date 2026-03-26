import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getRestaurantForOwner } from "../lib/restaurant";

type MenuItem = { id: string; name: string };
type MysteryBasket = {
  id: string;
  name: string | null;
  bundle_size: number;
  mystery_discount_percent: number;
};

export default function MysteryBaskets({ ownerUserId }: { ownerUserId: string }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [baskets, setBaskets] = useState<MysteryBasket[]>([]);

  const [name, setName] = useState("");
  const [bundleSize, setBundleSize] = useState<string>("3");
  const [mysteryDiscountPercent, setMysteryDiscountPercent] = useState<string>("50");
  const [selectedEligible, setSelectedEligible] = useState<Record<string, boolean>>({});

  async function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: items, error: itemsErr } = await supabase.from("menu_items").select("id,name").eq("restaurant_id", restaurantId);
      if (itemsErr) throw itemsErr;
      setMenuItems((items ?? []).map((i: any) => ({ id: String(i.id), name: String(i.name) })));

      const { data: basketRows, error: basketsErr } = await supabase.from("mystery_baskets").select("*").eq("restaurant_id", restaurantId);
      if (basketsErr) throw basketsErr;
      setBaskets((basketRows ?? []).map((b: any) => ({
        id: String(b.id),
        name: b.name ? String(b.name) : null,
        bundle_size: Number(b.bundle_size),
        mystery_discount_percent: Number(b.mystery_discount_percent),
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

  async function createBasket() {
    if (!restaurantId) return;
    setError(null);

    const bundle = Number(bundleSize);
    const disc = Number(mysteryDiscountPercent);
    if (!Number.isFinite(bundle) || bundle <= 0) {
      setError("bundle_size must be > 0");
      return;
    }
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      setError("mystery_discount_percent must be 0-100");
      return;
    }

    const eligibleIds = Object.entries(selectedEligible)
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    if (eligibleIds.length === 0) {
      setError("Select at least one eligible menu item.");
      return;
    }

    // Create basket
    const { data: created, error: createErr } = await supabase
      .from("mystery_baskets")
      .insert({
        restaurant_id: restaurantId,
        name: name.trim() ? name.trim() : null,
        bundle_size: bundle,
        mystery_discount_percent: disc,
      })
      .select("*")
      .single();
    if (createErr) throw createErr;

    const basketId = created.id;

    // Insert eligible items
    const rows = eligibleIds.map((menu_item_id) => ({
      mystery_basket_id: basketId,
      menu_item_id,
    }));

    const { error: relErr } = await supabase.from("mystery_basket_items").insert(rows);
    if (relErr) throw relErr;

    // Reset
    setName("");
    setBundleSize("3");
    setMysteryDiscountPercent("50");
    setSelectedEligible({});

    await refresh();
  }

  const selectedCount = useMemo(
    () => Object.values(selectedEligible).filter(Boolean).length,
    [selectedEligible],
  );

  if (loading) return <div>Loading...</div>;
  if (!restaurantId) return <div>Create your restaurant first in Onboarding.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>Mystery Baskets</h2>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 640 }}>
        <h3>Create Mystery Basket</h3>
        <label>
          Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10, marginLeft: 8, width: "100%" }} />
        </label>
        <label>
          Bundle size (units)
          <input type="number" value={bundleSize} onChange={(e) => setBundleSize(e.target.value)} step="1" style={{ padding: 10, marginLeft: 8, width: 140 }} />
        </label>
        <label>
          Mystery discount %
          <input
            type="number"
            value={mysteryDiscountPercent}
            onChange={(e) => setMysteryDiscountPercent(e.target.value)}
            step="0.01"
            style={{ padding: 10, marginLeft: 8, width: 180 }}
          />
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div>Eligible items ({selectedCount})</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {menuItems.map((mi) => (
              <label key={mi.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selectedEligible[mi.id]}
                  onChange={(e) => setSelectedEligible((p) => ({ ...p, [mi.id]: e.target.checked }))}
                />
                {mi.name}
              </label>
            ))}
          </div>
        </div>

        <button onClick={createBasket} disabled={menuItems.length === 0}>Create Basket</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Name</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Bundle Size</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Discount %</th>
            </tr>
          </thead>
          <tbody>
            {baskets.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{b.name ?? "Mystery"}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>id={b.id}</div>
                </td>
                <td style={{ padding: 8 }}>{b.bundle_size}</td>
                <td style={{ padding: 8 }}>{b.mystery_discount_percent.toFixed(2)}%</td>
              </tr>
            ))}
            {baskets.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 16 }}>No mystery baskets yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

