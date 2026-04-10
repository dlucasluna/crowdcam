import type { RealtimeChannel } from "@supabase/supabase-js";
import { sendSignal } from "./signaling";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export interface PeerInfo {
  id: string;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
}

/**
 * Apply low-latency bitrate cap on video senders.
 * Lower max bitrate reduces buffering and improves perceived latency.
 */
export async function applyBitrateCap(pc: RTCPeerConnection, maxBitrateKbps = 1500) {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind !== "video") continue;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    for (const encoding of params.encodings) {
      encoding.maxBitrate = maxBitrateKbps * 1000;
      // Prioritize framerate over resolution when bandwidth is constrained
      (encoding as any).degradationPreference = "maintain-framerate";
    }
    try {
      await sender.setParameters(params);
    } catch (err) {
      console.warn("[WebRTC] Could not set bitrate cap:", err);
    }
  }
}

export function createPeerConnection(
  channel: RealtimeChannel,
  localId: string,
  remoteId: string,
  onTrack?: (stream: MediaStream) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Viewer side must explicitly request a remote video track
  pc.addTransceiver("video", { direction: "recvonly" });

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC ${localId}→${remoteId}] Connection state:`, pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC ${localId}→${remoteId}] ICE state:`, pc.iceConnectionState);
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal(channel, {
        type: "ice",
        from: localId,
        to: remoteId,
        payload: e.candidate.toJSON(),
      });
    }
  };

  pc.ontrack = (e) => {
    console.log(`[WebRTC ${localId}→${remoteId}] ontrack fired, streams:`, e.streams.length);
    const stream = e.streams[0] ?? new MediaStream([e.track]);
    if (onTrack) {
      onTrack(stream);
    }
  };

  return pc;
}

export async function createOffer(
  pc: RTCPeerConnection,
  channel: RealtimeChannel,
  localId: string,
  remoteId: string
) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(channel, {
    type: "offer",
    from: localId,
    to: remoteId,
    payload: pc.localDescription?.toJSON(),
  });
}

export async function handleOffer(
  pc: RTCPeerConnection,
  channel: RealtimeChannel,
  localId: string,
  remoteId: string,
  offer: RTCSessionDescriptionInit
) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // Apply bitrate cap on sender side (camera) after negotiation
  await applyBitrateCap(pc);

  sendSignal(channel, {
    type: "answer",
    from: localId,
    to: remoteId,
    payload: pc.localDescription?.toJSON(),
  });
}

export async function handleAnswer(
  pc: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function handleIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
) {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn("Failed to add ICE candidate:", err);
  }
}
