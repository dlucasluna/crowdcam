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
  const { data, error } = await supabase
    .from("rooms")
    .insert({ code })
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

export function getCameraLink(roomId: string) {
  return `${window.location.origin}/cam/${roomId}`;
}
