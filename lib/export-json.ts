import type { AyahRange, Timestamp } from "./surah-data";

export type TimestampExport = {
  range: AyahRange;
  timestamps: {
    key: string;
    surah: number;
    ayah: number;
    start: number;
    end?: number;
  }[];
};

export function buildTimestampExport(range: AyahRange, timestamps: Timestamp[]): TimestampExport {
  return {
    range,
    timestamps: timestamps
      .filter((timestamp) => Number.isFinite(timestamp.start))
      .map((timestamp) => ({
        key: timestamp.key,
        surah: timestamp.surah,
        ayah: timestamp.ayah,
        start: Number(timestamp.start.toFixed(2)),
        ...(Number.isFinite(timestamp.end)
          ? { end: Number(timestamp.end!.toFixed(2)) }
          : {}),
      }))
      .sort((a, b) => (a.surah === b.surah ? a.ayah - b.ayah : a.surah - b.surah)),
  };
}

export function downloadTimestampJson(range: AyahRange, timestamps: Timestamp[]) {
  const payload = buildTimestampExport(range, timestamps);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `surah-${range.startSurah}-${range.startAyah}-to-${range.endSurah}-${range.endAyah}-tafseer.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}
