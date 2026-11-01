# Flick Class: Lecture App Zone Setup & Architecture

Flick Class is a live, privacy-first lecture and classroom space for universities, bootcamps, and study circles.

## 1. Environment Variables

To use an external LiveKit SFU cluster for high-scale voice mesh, set the following environment variables (optional — Flick Class defaults to built-in Web Audio & Supabase Realtime broadcast when unconfigured):

```env
# Optional LiveKit SFU credentials
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Supabase Realtime & Database (Already configured in Flick)
VITE_SUPABASE_URL=https://lyuwkxfqgknaddmmigek.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

*Note: Before adding any paid cloud services, confirmation from the user is required as per project guidelines.*

---

## 2. Key Features

- **World-Transition Entrance**: 60fps Starfield canvas with Bricolage Grotesque (wdth 75, wght 800) fly-through title, accelerating warp streaks, and circular clip-path reveal into the classroom.
- **Synchronized 16:9 Slides**: Lecturer's active slide index is broadcast live to all students; students can browse freely and return via "Jump to lecturer's slide".
- **Live Lecturer Typing**: High-elegance Instrument Serif (~22px) notes panel transmitting 50ms debounced diffs with live typing indicator and blinking caret.
- **Voice & Speaking Rings**: Web Audio API `AudioContext` and `AnalyserNode` monitoring real audio decibels to drive speaking rings and live microphone level meters.
- **Role Permissions & Moderation**: Lecturer/Co-Host controls for Mute All, individual mute, student removal, and moderated Hand-Raise queue.
- **Privacy First**: Zero third-party telemetry, invite-only 6-character room codes (`join_code`), and no storage of recordings without explicit lecturer activation.
