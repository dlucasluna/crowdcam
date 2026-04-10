import { supabase } from "@/integrations/supabase/client";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function createRoom(code: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("rooms")
    .insert({ code, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findRoom(code: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select()
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActiveRooms() {
  const { data, error } = await supabase
    .from("rooms")
    .select()
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deactivateRoom(code: string) {
  const { error } = await supabase
    .from("rooms")
    .update({ is_active: false })
    .eq("code", code);
  if (error) throw error;
}

export function getCameraLink(roomId: string) {
  return `${window.location.origin}/cam/${roomId}`;
}
