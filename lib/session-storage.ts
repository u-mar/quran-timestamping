import type { AyahRange, Timestamp } from "./surah-data";

export type SavedSession = {
  range: AyahRange;
  timestamps: {
    key: string;
    surah: number;
    ayah: number;
    start: number;
    end?: number;
  }[];
  currentAyahKey: string | null;
  audioFileName: string | null;
  savedAt: number;
};

const STORAGE_PREFIX = "quran-timestamp-editor";

export function makeSessionKey(range: AyahRange): string {
  return `${STORAGE_PREFIX}:${range.startSurah}:${range.startAyah}-${range.endSurah}:${range.endAyah}`;
}

export function loadSession(range: AyahRange): SavedSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(makeSessionKey(range));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SavedSession;
  } catch {
    return null;
  }
}

export function saveSession(
  range: AyahRange,
  timestamps: Timestamp[],
  currentAyahKey: string | null,
  audioFileName: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: SavedSession = {
    range,
    timestamps: timestamps
      .filter((timestamp) => Number.isFinite(timestamp.start))
      .map((timestamp) => ({
        key: timestamp.key,
        surah: timestamp.surah,
        ayah: timestamp.ayah,
        start: timestamp.start,
        ...(Number.isFinite(timestamp.end) ? { end: timestamp.end } : {}),
      })),
    currentAyahKey,
    audioFileName: audioFileName && audioFileName !== "No audio loaded" ? audioFileName : null,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(makeSessionKey(range), JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable
  }
}
