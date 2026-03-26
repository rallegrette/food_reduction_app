import { supabase } from "./supabaseClient";

export function todayISODate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function getRestaurantForOwner(ownerUserId: string) {
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_user_id", ownerUserId);
  if (error) throw error;
  if (!restaurants || restaurants.length === 0) return null;
  return restaurants[0];
}

