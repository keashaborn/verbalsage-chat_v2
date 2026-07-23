# OpenAI-Only Consolidation Checkpoint — 2026-06-30

## Frontend / Verbal Sage v2

Path: `/var/www/verbalsage-chat_v2`

Completed:

- Removed Grok/xAI model selector surfaces.
- Removed Grok realtime admin/settings UI.
- Forced admin voice settings to OpenAI.
- Removed active Grok runtime from `BrainsChatPane`.
- Removed stale frontend Grok voice route/hook/panel:
  - `app/api/voice/ws-token/route.ts`
  - `hooks/useGrokVoice.ts`
  - `components/admin/GrokVoiceRealtimePanel.tsx`
- Cleaned stale Grok code from assistant-ui thread.
- Moved frontend `/api/tts` to proxy through Brains `/voice/tts`.
- Retired direct Realtime answer generation and transcription-only WebRTC.
- Current governed voice uses:
  - `POST /api/voice/openai/transcribe`
  - authenticated `/api/chat` orchestration
  - `/api/tts` speech synthesis

Validated:

- `verbalsage-v2.service` active.
- Frontend provider audit clean:
  - no `grok`
  - no `xai`
  - no `XAI_API_KEY`
  - no `VOICE_WS_TOKEN`
  - no `/ws/voice`
  - no `/api/voice/ws-token`
  - no frontend `OPENAI_API_KEY`
  - no direct `api.openai.com/v1/audio/speech`
- Remaining frontend voice routes:
  - `app/api/tts/route.ts`
  - `app/api/voice/openai/transcribe/route.ts`

Relevant commits:

- `49a285c auto: snapshot 2026-06-30T13:30:22Z` — OpenAI-only model selector changes
- `0366f44 Add OpenAI realtime voice BFF route`
- `4baf3f1 Force admin voice settings to OpenAI`
- `568bea3 auto: snapshot 2026-06-30T15:00:40Z` — TTS proxy through Brains
- `7c5b524 Disable legacy Grok runtime in active chat`
- `d4111dd auto: snapshot 2026-06-30T18:31:35Z` — removed stale frontend Grok surfaces

2026-07-23 retirement update:

- Removed the unused transcription-only WebRTC offer route.
- Renamed the active permission to `voice.transcription`.
- Renamed the continuous governed conversation hook to remove obsolete Realtime terminology.

## Desired Runtime Shape

Browser → Next.js BFF → Brains → OpenAI

Frontend should not hold `OPENAI_API_KEY`.
