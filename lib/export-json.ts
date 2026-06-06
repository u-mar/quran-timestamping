import type { AyahRange, Timestamp } from "./surah-data";

export type TimestampExport = {
  file: string;
  timeFormat: "seconds";
  ayahs: {
    key: string;
    start: number;
    end?: number;
  }[];
};

function formatTimestampValue(value: number): number {
  const rounded = Number(value.toFixed(2));
  return rounded % 1 === 0 ? Math.round(rounded) : rounded;
}

export function buildTimestampExport(
  audioFileName: string,
  timestamps: Timestamp[],
): TimestampExport {
  return {
    file: audioFileName,
    timeFormat: "seconds",
    ayahs: timestamps
      .filter((timestamp) => Number.isFinite(timestamp.start))
      .map((timestamp) => ({
        key: timestamp.key,
        start: formatTimestampValue(timestamp.start),
        ...(Number.isFinite(timestamp.end)
          ? { end: formatTimestampValue(timestamp.end!) }
          : {}),
      }))
      .sort((left, right) => {
        const [leftSurah, leftAyah] = left.key.split(":").map(Number);
        const [rightSurah, rightAyah] = right.key.split(":").map(Number);

        return leftSurah === rightSurah ? leftAyah - rightAyah : leftSurah - rightSurah;
      }),
  };
}

function buildExportFileName(range: AyahRange, audioFileName: string): string {
  if (audioFileName && audioFileName !== "No audio loaded") {
    const baseName = audioFileName.replace(/\.[^.]+$/, "");
    return `${baseName}.json`;
  }

  return `surah-${range.startSurah}-${range.startAyah}-to-${range.endSurah}-${range.endAyah}.json`;
}

export function downloadTimestampJson(
  range: AyahRange,
  audioFileName: string,
  timestamps: Timestamp[],
) {
  const payload = buildTimestampExport(audioFileName, timestamps);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = buildExportFileName(range, audioFileName);
  anchor.click();

  URL.revokeObjectURL(url);
}
