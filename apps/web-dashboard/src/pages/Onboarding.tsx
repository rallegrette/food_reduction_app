import React, { useEffect, useState } from "react";
import { getRestaurantForOwner } from "../lib/restaurant";
import { supabase } from "../lib/supabaseClient";

type RestaurantSettingsRow = {
  regular_enabled: boolean;
  mystery_enabled: boolean;
};

export default function Onboarding({ ownerUserId }: { ownerUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");

  const [regularEnabled, setRegularEnabled] = useState(true);
  const [mysteryEnabled, setMysteryEnabled] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getRestaurantForOwner(ownerUserId);
        if (!mounted) return;
        if (!r) {
          setRestaurantId(null);
          setRestaurantName("");
          setStripeAccountId("");
          setLatitude("");
          setLongitude("");
          setRegularEnabled(true);
          setMysteryEnabled(true);
          return;
        }

        setRestaurantId(String(r.id));
        setRestaurantName(r.name ?? "");
        setStripeAccountId(r.stripe_connected_account_id ?? "");
        setLatitude(r.latitude != null ? String(r.latitude) : "");
        setLongitude(r.longitude != null ? String(r.longitude) : "");

        const { data: settings, error: settingsErr } = await supabase
          .from("restaurant_settings")
          .select("*")
          .eq("restaurant_id", r.id)
          .maybeSingle();
        if (settingsErr) throw settingsErr;

        if (settings) {
          setRegularEnabled(!!(settings as RestaurantSettingsRow).regular_enabled);
          setMysteryEnabled(!!(settings as RestaurantSettingsRow).mystery_enabled);
        }
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

  async function createOrUpdateRestaurant() {
    setSaving(true);
    setError(null);
    try {
      const lat = latitude === "" ? null : Number(latitude);
      const lon = longitude === "" ? null : Number(longitude);
      if (lat !== null && !Number.isFinite(lat)) {
        setError("Latitude must be a valid number.");
        setSaving(false);
        return;
      }
      if (lon !== null && !Number.isFinite(lon)) {
        setError("Longitude must be a valid number.");
        setSaving(false);
        return;
      }

      if (!restaurantId) {
        const { data: created, error: createErr } = await supabase
          .from("restaurants")
          .insert({
            owner_user_id: ownerUserId,
            name: restaurantName,
            stripe_connected_account_id: stripeAccountId || null,
            latitude: lat,
            longitude: lon,
          })
          .select("*")
          .single();
        if (createErr) throw createErr;
        setRestaurantId(String(created.id));

        const { error: settingsErr } = await supabase.from("restaurant_settings").upsert({
          restaurant_id: created.id,
          regular_enabled: regularEnabled,
          mystery_enabled: mysteryEnabled,
        });
        if (settingsErr) throw settingsErr;
      } else {
        const { error: updateErr } = await supabase
          .from("restaurants")
          .update({
            name: restaurantName,
            stripe_connected_account_id: stripeAccountId || null,
            latitude: lat,
            longitude: lon,
          })
          .eq("id", restaurantId);
        if (updateErr) throw updateErr;

        const { error: settingsErr } = await supabase.from("restaurant_settings").upsert({
          restaurant_id: restaurantId,
          regular_enabled: regularEnabled,
          mystery_enabled: mysteryEnabled,
        });
        if (settingsErr) throw settingsErr;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <h2>Onboarding</h2>
        <p>Set your restaurant details, enable regular deals/mystery baskets, and provide Stripe Connected Account ID.</p>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label>
          Restaurant name
          <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="e.g., La Bodega" style={{ padding: 10, width: "100%" }} />
        </label>
        <label>
          Stripe Connected Account ID
          <input value={stripeAccountId} onChange={(e) => setStripeAccountId(e.target.value)} placeholder="acct_xxx" style={{ padding: 10, width: "100%" }} />
        </label>
        <label>
          Latitude
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="34.0195" style={{ padding: 10, width: "100%" }} />
        </label>
        <label>
          Longitude
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-118.4912" style={{ padding: 10, width: "100%" }} />
        </label>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <h3>Deal Types</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={regularEnabled} onChange={(e) => setRegularEnabled(e.target.checked)} />
          Enable regular deals
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={mysteryEnabled} onChange={(e) => setMysteryEnabled(e.target.checked)} />
          Enable mystery baskets
        </label>

        <div style={{ marginTop: 12 }}>
          <button onClick={createOrUpdateRestaurant} disabled={saving || restaurantName.trim().length === 0}>
            {restaurantId ? "Save" : "Create restaurant"}
          </button>
        </div>

        {restaurantId ? <div>Restaurant ID: {restaurantId}</div> : <div>Create to start configuring deals.</div>}
      </div>

      {error ? <div style={{ gridColumn: "1 / -1", color: "crimson" }}>{error}</div> : null}
    </div>
  );
}

