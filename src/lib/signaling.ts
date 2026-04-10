import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalType = "join" | "offer" | "answer" | "ice" | "select" | "leave";

export interface SignalMessage {
  type: SignalType;
  from: string;
  to?: string;
  payload?: any;
}

export async function createSignalingChannel(
  roomId: string,
  participantId: string,
  onMessage: (msg: SignalMessage) => void
): Promise<RealtimeChannel> {
  const channel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    const msg = payload as SignalMessage;
    console.log(`[Signal ${participantId}] Received:`, msg.type, "from:", msg.from, "to:", msg.to || "broadcast");
    // Ignore messages from self, accept broadcast or targeted messages
    if (msg.from !== participantId && (!msg.to || msg.to === participantId)) {
      onMessage(msg);
    } else {
      console.log(`[Signal ${participantId}] Ignored (self or not targeted)`);
    }
  });

  return new Promise<RealtimeChannel>((resolve) => {
    channel.subscribe((status) => {
      console.log(`[Signal ${participantId}] Channel status:`, status);
      if (status === "SUBSCRIBED") {
        resolve(channel);
      }
    });
    setTimeout(() => resolve(channel), 3000);
  });
}

export function sendSignal(
  channel: RealtimeChannel,
  message: SignalMessage
) {
  console.log(`[Signal] Sending:`, message.type, "from:", message.from, "to:", message.to || "broadcast");
  channel.send({
    type: "broadcast",
    event: "signal",
    payload: message,
  });
}
