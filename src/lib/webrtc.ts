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

export function createPeerConnection(
  channel: RealtimeChannel,
  localId: string,
  remoteId: string,
  onTrack?: (stream: MediaStream) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
    if (e.streams[0] && onTrack) {
      onTrack(e.streams[0]);
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
