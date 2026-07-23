export const FIRST_SPEECH_SEGMENT_CHARACTERS = 160;
export const FOLLOWING_SPEECH_SEGMENT_CHARACTERS = 900;
export const SPEECH_PCM_SAMPLE_RATE = 24_000;

export function splitForSpeech(
  text: string,
  firstChunkCharacters = FIRST_SPEECH_SEGMENT_CHARACTERS,
  followingChunkCharacters = FOLLOWING_SPEECH_SEGMENT_CHARACTERS,
): string[] {
  const words = String(text || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const currentLimit = () =>
    chunks.length === 0 ? firstChunkCharacters : followingChunkCharacters;
  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (let word of words) {
    while (word.length > currentLimit()) {
      flush();
      const limit = currentLimit();
      chunks.push(word.slice(0, limit));
      word = word.slice(limit);
    }
    if (!word) continue;

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= currentLimit()) {
      current = candidate;
    } else {
      flush();
      if (word.length <= currentLimit()) {
        current = word;
      }
    }
  }

  flush();
  return chunks;
}

export function shouldUseNativeSafariAudio(userAgent: string): boolean {
  const value = String(userAgent || "");
  return (
    /Safari/i.test(value) &&
    !/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Android)/i.test(value)
  );
}

export function endOfSpeechToFirstAudioMs(
  speechEndedAtMs: number,
  firstAudioAtMs: number | null,
): number | null {
  if (
    firstAudioAtMs == null ||
    !Number.isFinite(speechEndedAtMs) ||
    !Number.isFinite(firstAudioAtMs)
  ) {
    return null;
  }
  return Math.max(0, Math.round(firstAudioAtMs - speechEndedAtMs));
}

export function pcmS16leToWav(
  pcm: Uint8Array,
  sampleRate = SPEECH_PCM_SAMPLE_RATE,
): Uint8Array {
  if (pcm.byteLength % 2 !== 0) {
    throw new Error("PCM audio must contain complete 16-bit samples.");
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error("Audio sample rate must be a positive integer.");
  }

  const headerBytes = 44;
  const output = new Uint8Array(headerBytes + pcm.byteLength);
  const view = new DataView(output.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      output[offset + index] = value.charCodeAt(index);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  output.set(pcm, headerBytes);
  return output;
}
