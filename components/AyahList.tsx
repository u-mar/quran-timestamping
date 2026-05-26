"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ayah, Timestamp } from "@/lib/surah-data";
import { formatClockTime } from "@/lib/time";

type AyahListProps = {
  ayahs: Ayah[];
  timestamps: Timestamp[];
  activeAyahKey: string | null;
  previewAyahKey: string | null;
  onSeekToTimestamp: (seconds: number) => void;
  onSetCurrentAyah: (key: string) => void;
  onPreviewAyah: (key: string) => void;
};

export default function AyahList({
  ayahs,
  timestamps,
  activeAyahKey,
  previewAyahKey,
  onSeekToTimestamp,
  onSetCurrentAyah,
  onPreviewAyah,
}: AyahListProps) {
  const [showDoneAyahs, setShowDoneAyahs] = useState(false);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedKeyRef = useRef<string | null>(null);
  const timestampByKey = useMemo(() => {
    return new Map(timestamps.map((timestamp) => [timestamp.key, timestamp]));
  }, [timestamps]);
  const visibleAyahs = useMemo(() => {
    if (showDoneAyahs) {
      return ayahs;
    }

    return ayahs.filter((ayah) => {
      const timestamp = timestampByKey.get(ayah.key);

      return !timestamp || !Number.isFinite(timestamp.end);
    });
  }, [ayahs, showDoneAyahs, timestampByKey]);
  const doneCount = useMemo(() => {
    return timestamps.filter((timestamp) => Number.isFinite(timestamp.end)).length;
  }, [timestamps]);

  useEffect(() => {
    if (!activeAyahKey) {
      return;
    }

    rowRefs.current[activeAyahKey]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeAyahKey]);

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">
              {showDoneAyahs ? "All ayahs" : "Pending ayahs"}
            </h2>
            <p className="text-sm text-slate-500">
              Start-only ayahs stay visible. Use Show done to edit old start times.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDoneAyahs((current) => !current)}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {showDoneAyahs ? "Hide done" : `Show done (${doneCount})`}
          </button>
        </div>
      </div>

      <div className="min-h-[28rem] flex-1 overflow-y-auto p-2">
        {ayahs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Choose a range and load Quran ayahs.
          </div>
        ) : null}

        {ayahs.length > 0 && visibleAyahs.length === 0 ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-6 text-center text-sm text-teal-800">
            All ayahs in this range have start and end times.
          </div>
        ) : null}

        {visibleAyahs.map((ayah) => {
          const timestamp = timestampByKey.get(ayah.key);
          const isCompleted = Boolean(timestamp && Number.isFinite(timestamp.end));
          const isInProgress = Boolean(timestamp && !Number.isFinite(timestamp.end));
          const isActive = ayah.key === activeAyahKey;
          const isPreviewing = ayah.key === previewAyahKey;

          return (
            <button
              key={ayah.key}
              type="button"
              ref={(node) => {
                rowRefs.current[ayah.key] = node;
              }}
              onPointerDown={() => {
                clearLongPressTimer();
                longPressedKeyRef.current = null;

                if (!isCompleted) {
                  return;
                }

                longPressTimerRef.current = setTimeout(() => {
                  longPressedKeyRef.current = ayah.key;
                  onPreviewAyah(ayah.key);
                }, 450);
              }}
              onPointerUp={clearLongPressTimer}
              onPointerLeave={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => {
                if (longPressedKeyRef.current === ayah.key) {
                  longPressedKeyRef.current = null;
                  return;
                }

                onSetCurrentAyah(ayah.key);

                if (timestamp) {
                  onSeekToTimestamp(timestamp.start);
                }
              }}
              className={`mb-2 grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                isPreviewing
                  ? "border-amber-400 bg-amber-100 shadow-sm"
                  : isActive
                    ? "border-teal-500 bg-teal-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="flex h-9 min-w-12 items-center justify-center rounded-full bg-slate-100 px-2 text-sm font-semibold text-slate-700">
                {ayah.surah}:{ayah.ayah}
              </span>
              <span
                className="max-h-16 overflow-hidden text-right font-serif text-lg leading-8 text-slate-950"
                dir="rtl"
              >
                {ayah.text}
              </span>
              <span className="font-mono text-xs text-slate-600">
                {formatClockTime(timestamp?.start)}
                {timestamp?.end ? `-${formatClockTime(timestamp.end)}` : ""}
              </span>
              <span
                className={`text-lg ${
                  isCompleted
                    ? "text-teal-600"
                    : isInProgress
                      ? "text-amber-600"
                      : "text-slate-400"
                }`}
                aria-label={isCompleted ? "completed" : isInProgress ? "started" : "pending"}
              >
                {isCompleted ? "✔" : isInProgress ? "◐" : "○"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
