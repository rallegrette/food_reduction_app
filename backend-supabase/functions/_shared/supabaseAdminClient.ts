import { createClient } from "https://esm.sh/@supabase/supabase-js";

export function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  // Use service role for server-side reads/writes.
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

