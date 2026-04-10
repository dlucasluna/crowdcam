import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalType = "join" | "offer" | "answer" | "ice" | "select" | "leave";

export interface SignalMessage {
  type: SignalType;
  from: string;
  to?: string;
  payload?: any;
}

export function createSignalingChannel(
  roomId: string,
  participantId: string,
  onMessage: (msg: SignalMessage) => void
): RealtimeChannel {
  const channel = supabase.channel(`room:${roomId}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    const msg = payload as SignalMessage;
    // Ignore messages from self, accept broadcast or targeted messages
    if (msg.from !== participantId && (!msg.to || msg.to === participantId)) {
      onMessage(msg);
    }
  });

  channel.subscribe();

  return channel;
}

export function sendSignal(
  channel: RealtimeChannel,
  message: SignalMessage
) {
  channel.send({
    type: "broadcast",
    event: "signal",
    payload: message,
  });
}
