import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Onboarding from "./pages/Onboarding";
import MenuInventory from "./pages/MenuInventory";
import PricingRules from "./pages/PricingRules";
import MysteryBaskets from "./pages/MysteryBaskets";
import Orders from "./pages/Orders";

type SessionUser = { id: string; email?: string } | null;
type PageKey = "onboarding" | "menu" | "rules" | "mystery" | "orders";

export default function App() {
  const [user, setUser] = useState<SessionUser>(null);
  const [page, setPage] = useState<PageKey>("onboarding");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const restaurantId = useMemo(() => {
    // Pages will resolve the restaurant for the signed-in user themselves.
    // This memo exists mainly for rendering nav gating in case you want it later.
    return user?.id ?? null;
  }, [user]);

  async function signIn() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) {
      setAuthError(String(e));
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUp() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } catch (e) {
      setAuthError(String(e));
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPage("onboarding");
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 680, margin: "32px auto", padding: 16, fontFamily: "system-ui, -apple-system" }}>
        <h1>FlexBite Restaurant Dashboard</h1>
        <p>Sign in with Supabase Auth to manage your restaurant.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <input
            value={email}
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={{ padding: 10 }}
          />
          <input
            value={password}
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{ padding: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={signIn} disabled={authLoading}>
              Sign In
            </button>
            <button onClick={signUp} disabled={authLoading}>
              Sign Up
            </button>
          </div>
          {authError ? <div style={{ color: "crimson" }}>{authError}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <div>
          <strong>FlexBite Dashboard</strong>
          <div style={{ fontSize: 12, color: "#555" }}>{user.email ?? user.id}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPage("onboarding")} disabled={page === "onboarding"}>
            Onboarding
          </button>
          <button onClick={() => setPage("menu")} disabled={page === "menu"}>
            Menu/Inventory
          </button>
          <button onClick={() => setPage("rules")} disabled={page === "rules"}>
            Rules
          </button>
          <button onClick={() => setPage("mystery")} disabled={page === "mystery"}>
            Mystery
          </button>
          <button onClick={() => setPage("orders")} disabled={page === "orders"}>
            Orders
          </button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
        {page === "onboarding" ? (
          <Onboarding ownerUserId={user.id} />
        ) : null}
        {page === "menu" ? <MenuInventory ownerUserId={user.id} /> : null}
        {page === "rules" ? <PricingRules ownerUserId={user.id} /> : null}
        {page === "mystery" ? <MysteryBaskets ownerUserId={user.id} /> : null}
        {page === "orders" ? <Orders ownerUserId={user.id} /> : null}
      </main>
    </div>
  );
}

