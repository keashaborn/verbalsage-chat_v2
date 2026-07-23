export const FIRST_SPEECH_SEGMENT_CHARACTERS = 320;
export const FOLLOWING_SPEECH_SEGMENT_CHARACTERS = 900;

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
