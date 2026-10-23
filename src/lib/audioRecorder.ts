/**
 * Audio Recording and Microphone Permission Utility for Flick
 */

export type MicPermissionStatus = "granted" | "prompt" | "denied" | "unsupported";

export type MicErrorInfo = {
  kind: "denied" | "not_found" | "in_use" | "unsupported" | "unknown";
  title: string;
  message: string;
};

/**
 * Detect the best supported audio MIME type across Chrome, Safari, Firefox, Edge, and iOS.
 */
export function getSupportedAudioMimeType(): { mimeType: string; extension: string } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", extension: "webm" };
  }

  const candidates = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/aac", extension: "aac" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];

  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }

  return { mimeType: "", extension: "webm" };
}

/**
 * Check existing microphone permission status without popping a prompt.
 */
export async function checkMicrophonePermission(): Promise<MicPermissionStatus> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      // Some browsers (e.g. Safari) don't support 'microphone' in permissions.query
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return status.state;
    }
  } catch {
    /* ignore query failure */
  }

  return "prompt";
}

/**
 * Classify a getUserMedia error into friendly human-readable advice.
 */
export function classifyMicError(err: unknown): MicErrorInfo {
  const error = err as { name?: string; message?: string };
  const name = error?.name || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      kind: "denied",
      title: "Microphone Access Blocked",
      message:
        "Microphone permission was denied. Tap the lock/tune icon in your browser address bar or check system settings to allow microphone access for Flick.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "not_found",
      title: "No Microphone Detected",
      message: "No audio input hardware was found on this device. Please connect a microphone or headset.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      kind: "in_use",
      title: "Microphone In Use",
      message: "Your microphone is currently being used by another application or call. Please close other audio apps and try again.",
    };
  }

  if (name === "NotSupportedError" || !navigator.mediaDevices?.getUserMedia) {
    return {
      kind: "unsupported",
      title: "Audio Recording Not Supported",
      message: "This browser environment does not support media recording. Please open Flick in Chrome, Edge, Safari or the desktop app.",
    };
  }

  return {
    kind: "unknown",
    title: "Microphone Unavailable",
    message: error?.message || "Could not start audio recording. Please verify your microphone permissions.",
  };
}

/**
 * Generates a real, playable WAV voice note audio file for testing or when physical microphone is absent.
 */
export function generateSyntheticVoiceNoteBlob(durationSec = 2.5): Blob {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1;

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Write synthetic melodic voice greeting waveform
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Harmonized vocal formant simulation (pitch contour)
    const baseFreq = 220 + 30 * Math.sin(2 * Math.PI * 1.5 * t);
    const formant = Math.sin(2 * Math.PI * baseFreq * t) * 0.5 +
                    Math.sin(2 * Math.PI * (baseFreq * 2) * t) * 0.25 +
                    Math.sin(2 * Math.PI * (baseFreq * 3) * t) * 0.12;
    // Envelope (fade in and fade out)
    const env = Math.sin(Math.PI * (i / numSamples));
    const sample = Math.max(-1, Math.min(1, formant * env * 0.7));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
