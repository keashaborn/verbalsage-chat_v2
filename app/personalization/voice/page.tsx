import { VoicePanel } from "@/components/admin/VoicePanel";

export default function VoicePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>OpenAI Voice</h1>
      <VoicePanel />
    </main>
  );
}
