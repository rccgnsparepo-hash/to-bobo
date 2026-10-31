// Real WebRTC & Media Stream Engine for Flick Space (Live Broadcasts, Audio Rooms & Calls)
import { supabase } from "@/integrations/supabase/client";

export interface MediaDeviceState {
  hasCam: boolean;
  hasMic: boolean;
  camActive: boolean;
  micActive: boolean;
  facingMode: "user" | "environment";
  isScreenSharing: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

export class WebRtcEngine {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private channelName: string | null = null;
  private signalingChannel: ReturnType<typeof supabase.channel> | null = null;
  private currentUserId: string = "";
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  constructor(
    currentUserId: string,
    onRemoteStream?: (stream: MediaStream) => void,
    onStateChange?: (state: RTCPeerConnectionState) => void
  ) {
    this.currentUserId = currentUserId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onConnectionStateChangeCallback = onStateChange;
  }

  /**
   * Acquire local camera & microphone media stream with fallbacks
   */
  public async startLocalMedia(
    video: boolean = true,
    audio: boolean = true,
    facingMode: "user" | "environment" = "user"
  ): Promise<MediaStream> {
    this.stopLocalMedia();

    try {
      const constraints: MediaStreamConstraints = {
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
        video: video
          ? {
              facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn("Primary media constraint failed, attempting audio-only fallback:", err);
      if (video && audio) {
        // Fallback to audio only if camera is blocked or in use
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.localStream = fallbackStream;
        return fallbackStream;
      }
      throw err;
    }
  }

  /**
   * Acquire Screen Share display media
   */
  public async startScreenShare(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen sharing is not supported on this device/browser.");
    }
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    if (this.peerConnection && this.localStream) {
      const videoTrack = screenStream.getVideoTracks()[0];
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(videoTrack);
      }
    }
    return screenStream;
  }

  /**
   * Initialize signaling channel with Supabase Realtime Broadcast
   */
  public initSignaling(channelName: string, isInitiator: boolean): void {
    this.channelName = channelName;
    this.initPeerConnection();

    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    this.signalingChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.signalingChannel
      .on("broadcast", { event: "webrtc:request_offer" }, async ({ payload }) => {
        // Broadcaster receives request from a viewer who just joined
        if (isInitiator && payload?.viewerId) {
          await this.createAndSendOffer(payload.viewerId);
        }
      })
      .on("broadcast", { event: "webrtc:offer" }, async ({ payload }) => {
        // Viewer receives offer from broadcaster
        if (isInitiator) return; // Broadcaster ignores offers
        if (payload?.targetUserId && payload.targetUserId !== this.currentUserId) return;
        await this.handleOffer(payload.sdp, payload.senderId);
      })
      .on("broadcast", { event: "webrtc:answer" }, async ({ payload }) => {
        // Broadcaster receives answer from viewer
        if (!isInitiator) return;
        if (payload?.targetUserId && payload.targetUserId !== this.currentUserId) return;
        await this.handleAnswer(payload.sdp);
      })
      .on("broadcast", { event: "webrtc:candidate" }, async ({ payload }) => {
        if (payload?.targetUserId && payload.targetUserId !== this.currentUserId) return;
        if (payload?.candidate) {
          await this.handleCandidate(payload.candidate);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          if (isInitiator) {
            // Broadcaster announces offer ready
            await this.createAndSendOffer();
          } else {
            // Viewer immediately requests offer from broadcaster
            await this.signalingChannel?.send({
              type: "broadcast",
              event: "webrtc:request_offer",
              payload: { viewerId: this.currentUserId },
            });
          }
        }
      });
  }

  private initPeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.remoteStream = new MediaStream();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    this.peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingChannel) {
        void this.signalingChannel.send({
          type: "broadcast",
          event: "webrtc:candidate",
          payload: { candidate: event.candidate.toJSON(), senderId: this.currentUserId },
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
      }
    };
  }

  private async createAndSendOffer(targetUserId?: string): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) return;
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);

      await this.signalingChannel.send({
        type: "broadcast",
        event: "webrtc:offer",
        payload: { sdp: offer, senderId: this.currentUserId, targetUserId },
      });
    } catch (err) {
      console.warn("createAndSendOffer notice:", err);
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit, broadcasterId?: string): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await this.signalingChannel.send({
        type: "broadcast",
        event: "webrtc:answer",
        payload: { sdp: answer, senderId: this.currentUserId, targetUserId: broadcasterId },
      });
    } catch (err) {
      console.warn("handleOffer notice:", err);
    }
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async handleCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (e) {
      console.warn("Failed to add ICE candidate:", e);
    }
  }

  public toggleMic(enabled: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    return enabled;
  }

  public toggleCam(enabled: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    return enabled;
  }

  public stopLocalMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  public close(): void {
    this.stopLocalMedia();
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }
  }
}
