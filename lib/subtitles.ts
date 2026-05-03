function formatTimestamp(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const milliseconds = Math.round((totalSeconds % 1) * 1000)
    .toString()
    .padStart(3, "0");

  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

function chunkWords(words: string[]) {
  const chunks: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);

    const currentText = current.join(" ");
    const shouldBreak =
      current.length >= 5 ||
      currentText.length >= 26 ||
      /[.!?,:]$/.test(word);

    if (shouldBreak) {
      chunks.push(currentText);
      current = [];
    }
  }

  if (current.length) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

export function createSrtFromText(text: string, durationSeconds: number) {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const chunks = chunkWords(words);
  const safeDuration = Math.max(durationSeconds, 1);
  const chunkDuration = safeDuration / Math.max(chunks.length, 1);

  return chunks
    .map((chunk, index) => {
      const start = index * chunkDuration;
      const end = Math.min((index + 1) * chunkDuration, safeDuration);

      return [
        (index + 1).toString(),
        `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
        chunk,
        ""
      ].join("\n");
    })
    .join("\n");
}
