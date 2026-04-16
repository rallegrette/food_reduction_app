import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getRestaurantForOwner, todayISODate } from "../lib/restaurant";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  base_price: number;
};

type InventoryRow = {
  menu_item_id: string;
  quantity_total: number;
  quantity_remaining: number;
};

export default function MenuInventory({ ownerUserId }: { ownerUserId: string }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [invByItemId, setInvByItemId] = useState<Record<string, InventoryRow>>({});

  const today = useMemo(() => todayISODate(), []);

  // Add menu item form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newBasePrice, setNewBasePrice] = useState<string>("0");

  // Inventory inputs: map per item
  const [qtyTotalByItem, setQtyTotalByItem] = useState<Record<string, string>>({});
  const [qtyRemainingByItem, setQtyRemainingByItem] = useState<Record<string, string>>({});

  async function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: items, error: itemsErr } = await supabase
        .from("menu_items")
        .select("id,name,category,base_price")
        .eq("restaurant_id", restaurantId);
      if (itemsErr) throw itemsErr;

      const normalizedItems: MenuItem[] = (items ?? []).map((i: any) => ({
        id: String(i.id),
        name: String(i.name),
        category: String(i.category),
        base_price: Number(i.base_price),
      }));
      setMenuItems(normalizedItems);

      const { data: invRows, error: invErr } = await supabase
        .from("inventory_units")
        .select("menu_item_id,quantity_total,quantity_remaining")
        .eq("restaurant_id", restaurantId)
        .eq("inventory_date", today);
      if (invErr) throw invErr;

      const invMap: Record<string, InventoryRow> = {};
      for (const r of invRows ?? []) {
        invMap[String(r.menu_item_id)] = {
          menu_item_id: String(r.menu_item_id),
          quantity_total: Number(r.quantity_total),
          quantity_remaining: Number(r.quantity_remaining),
        };
      }
      setInvByItemId(invMap);

      // Seed inputs
      const newQtyTotal: Record<string, string> = {};
      const newQtyRemaining: Record<string, string> = {};
      for (const it of normalizedItems) {
        const inv = invMap[it.id];
        newQtyTotal[it.id] = String(inv?.quantity_total ?? 0);
        newQtyRemaining[it.id] = String(inv?.quantity_remaining ?? inv?.quantity_total ?? 0);
      }
      setQtyTotalByItem(newQtyTotal);
      setQtyRemainingByItem(newQtyRemaining);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await getRestaurantForOwner(ownerUserId);
        if (!mounted) return;
        if (!r) {
          setRestaurantId(null);
          setMenuItems([]);
          setInvByItemId({});
          return;
        }
        setRestaurantId(String(r.id));
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

  async function addMenuItem() {
    if (!restaurantId) return;
    setError(null);
    const price = Number(newBasePrice);
    if (!newName.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a valid name and base price.");
      return;
    }
    const { data, error: insErr } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: restaurantId,
        name: newName,
        category: newCategory || "other",
        base_price: price,
      })
      .select("id")
      .single();
    if (insErr) {
      setError(insErr.message ?? String(insErr));
      return;
    }
    setNewName("");
    setNewBasePrice("0");
    await refresh();
    return data;
  }

  async function upsertInventoryForItem(menuItemId: string) {
    if (!restaurantId) return;
    setError(null);
    const qt = Number(qtyTotalByItem[menuItemId] ?? "0");
    const qr = Number(qtyRemainingByItem[menuItemId] ?? "0");

    const { error: upErr } = await supabase.from("inventory_units").upsert(
      {
        restaurant_id: restaurantId,
        menu_item_id: menuItemId,
        inventory_date: today,
        quantity_total: qt,
        quantity_remaining: qr,
      },
      { onConflict: "restaurant_id,menu_item_id,inventory_date" },
    );
    if (upErr) {
      setError(upErr.message ?? String(upErr));
      return;
    }
    await refresh();
  }

  if (loading) return <div>Loading...</div>;

  if (!restaurantId) {
    return (
      <div>
        <h2>Menu & Inventory</h2>
        <p>Create your restaurant first in the Onboarding tab.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2>Menu & Inventory (Date: {today})</h2>

      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <h3>Add Menu Item</h3>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name" style={{ padding: 10 }} />
        <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" style={{ padding: 10 }} />
        <input value={newBasePrice} onChange={(e) => setNewBasePrice(e.target.value)} placeholder="Base price (USD)" type="number" step="0.01" style={{ padding: 10 }} />
        <button onClick={addMenuItem}>Add</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Item</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Base Price</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Qty Total</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Qty Remaining</th>
              <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>Save Inventory</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((it) => (
              <tr key={it.id}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{it.category}</div>
                </td>
                <td style={{ padding: 8 }}>${it.base_price.toFixed(2)}</td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    value={qtyTotalByItem[it.id] ?? "0"}
                    onChange={(e) => setQtyTotalByItem((p) => ({ ...p, [it.id]: e.target.value }))}
                    step="1"
                    style={{ padding: 8, width: 140 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    value={qtyRemainingByItem[it.id] ?? "0"}
                    onChange={(e) => setQtyRemainingByItem((p) => ({ ...p, [it.id]: e.target.value }))}
                    step="1"
                    style={{ padding: 8, width: 140 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => upsertInventoryForItem(it.id)}>Save</button>
                </td>
              </tr>
            ))}
            {menuItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16 }}>
                  No menu items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

