"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AyahList from "@/components/AyahList";
import PlayerControls from "@/components/PlayerControls";
import Waveform, { type WaveformHandle } from "@/components/Waveform";
import { downloadTimestampJson } from "@/lib/export-json";
import { useTimestampShortcuts } from "@/lib/keyboard";
import {
  compareAyahPosition,
  defaultRange,
  loadAyahsForRange,
  loadChapters,
  makeAyahKey,
  type Ayah,
  type AyahRange,
  type Chapter,
  type Timestamp,
} from "@/lib/surah-data";

type TimestampEditorProps = {
  initialSurahId?: number;
};

type MarkHistoryItem = {
  key: string;
  previousTimestamps: Timestamp[];
};

type PreviewState = {
  keys: string[];
  index: number;
  end: number;
};

type ImportTimestamp = {
  key?: string;
  surah?: number;
  ayah: number;
  start: number;
  end?: number;
};

function buildInitialRange(initialSurahId?: number): AyahRange {
  if (!initialSurahId || initialSurahId === 1) {
    return defaultRange;
  }

  return {
    startSurah: initialSurahId,
    startAyah: 1,
    endSurah: initialSurahId,
    endAyah: 1,
  };
}

function upsertTimestamp(timestamps: Timestamp[], timestamp: Timestamp) {
  return [...timestamps.filter((item) => item.key !== timestamp.key), timestamp].sort(
    compareAyahPosition,
  );
}

function getNextPendingAyahKey(ayahs: Ayah[], timestamps: Timestamp[], currentKey: string) {
  const completedKeys = new Set(
    timestamps
      .filter((timestamp) => Number.isFinite(timestamp.end))
      .map((timestamp) => timestamp.key),
  );
  const currentIndex = ayahs.findIndex((ayah) => ayah.key === currentKey);
  const nextAfterCurrent = ayahs
    .slice(Math.max(currentIndex + 1, 0))
    .find((ayah) => !completedKeys.has(ayah.key));

  if (nextAfterCurrent) {
    return nextAfterCurrent.key;
  }

  return ayahs.find((ayah) => !completedKeys.has(ayah.key))?.key ?? currentKey;
}

function getPlaybackAyahKey(ayahs: Ayah[], timestamps: Timestamp[], currentTime: number) {
  const timestampByKey = new Map(timestamps.map((timestamp) => [timestamp.key, timestamp]));

  return [...ayahs]
    .reverse()
    .find((ayah) => {
      const timestamp = timestampByKey.get(ayah.key);

      return timestamp ? timestamp.start <= currentTime : false;
    })?.key;
}

function formatRange(range: AyahRange) {
  return `${range.startSurah}:${range.startAyah} to ${range.endSurah}:${range.endAyah}`;
}

export default function TimestampEditor({ initialSurahId }: TimestampEditorProps) {
  const waveformRef = useRef<WaveformHandle | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const advancePreviewRef = useRef<(time: number) => void>(() => {});
  const previewStateRef = useRef<PreviewState | null>(null);
  const hasLoadedDefaultRangeRef = useRef(false);
  const initialRange = useMemo(() => buildInitialRange(initialSurahId), [initialSurahId]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [rangeDraft, setRangeDraft] = useState<AyahRange>(() => initialRange);
  const [loadedRange, setLoadedRange] = useState<AyahRange>(() => initialRange);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [isLoadingAyahs, setIsLoadingAyahs] = useState(false);
  const [rangeMessage, setRangeMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLabel, setAudioLabel] = useState("No audio loaded");
  const [timestamps, setTimestamps] = useState<Timestamp[]>([]);
  const [markHistory, setMarkHistory] = useState<MarkHistoryItem[]>([]);
  const [currentAyahKey, setCurrentAyahKey] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [previewState, setPreviewStateState] = useState<PreviewState | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const completedCount = timestamps.filter((timestamp) => Number.isFinite(timestamp.end)).length;
  const totalAyahs = ayahs.length;
  const progressPercentage = totalAyahs > 0 ? (completedCount / totalAyahs) * 100 : 0;
  const timestampByKey = useMemo(() => {
    return new Map(timestamps.map((timestamp) => [timestamp.key, timestamp]));
  }, [timestamps]);
  const activeAyahKey =
    previewState?.keys[previewState.index] ??
    getPlaybackAyahKey(ayahs, timestamps, currentTime) ??
    currentAyahKey;
  const currentAyah = useMemo(() => {
    return ayahs.find((ayah) => ayah.key === currentAyahKey);
  }, [ayahs, currentAyahKey]);
  const currentTimestamp = currentAyahKey ? timestampByKey.get(currentAyahKey) : undefined;
  const currentAyahIsDone = Boolean(currentTimestamp && Number.isFinite(currentTimestamp.end));
  const currentAyahIsStarted = Boolean(currentTimestamp && !Number.isFinite(currentTimestamp.end));
  const exportableTimestamps = useMemo(() => {
    return timestamps.filter((timestamp) => Number.isFinite(timestamp.start));
  }, [timestamps]);
  const hasOpenTimestamp = useMemo(() => {
    return timestamps.some((timestamp) => timestamp.end === undefined);
  }, [timestamps]);

  const setPreviewState = useCallback((nextPreviewState: PreviewState | null) => {
    previewStateRef.current = nextPreviewState;
    setPreviewStateState(nextPreviewState);
  }, []);

  const currentRangeTitle = useMemo(() => {
    if (chapters.length === 0) {
      return `Quran range ${formatRange(loadedRange)}`;
    }

    const startChapter = chapters.find((chapter) => chapter.id === loadedRange.startSurah);
    const endChapter = chapters.find((chapter) => chapter.id === loadedRange.endSurah);

    if (!startChapter || !endChapter) {
      return `Quran range ${formatRange(loadedRange)}`;
    }

    return `${startChapter.nameSimple} ${loadedRange.startAyah} to ${endChapter.nameSimple} ${loadedRange.endAyah}`;
  }, [chapters, loadedRange]);

  const getVerseCount = useCallback(
    (surahId: number) => {
      return chapters.find((chapter) => chapter.id === surahId)?.versesCount ?? 286;
    },
    [chapters],
  );

  const getTimestampSegment = useCallback(
    (key: string) => {
      const ayahIndex = ayahs.findIndex((ayah) => ayah.key === key);
      const timestamp = timestampByKey.get(key);

      if (!timestamp || ayahIndex === -1) {
        return null;
      }

      const end = timestamp.end;

      if (!end || end <= timestamp.start) {
        return null;
      }

      return {
        start: timestamp.start,
        end,
      };
    },
    [ayahs, timestampByKey],
  );

  const hydrateTimestamps = useCallback(
    (items: ImportTimestamp[], targetAyahs: Ayah[], fallbackSurah?: number) => {
      const ayahByKey = new Map(targetAyahs.map((ayah) => [ayah.key, ayah]));

      return items
        .map((item) => {
          const key = item.key ?? makeAyahKey(item.surah ?? fallbackSurah ?? 0, item.ayah);
          const ayah = ayahByKey.get(key);

          if (!ayah || !Number.isFinite(item.start)) {
            return null;
          }

          return {
            key,
            surah: ayah.surah,
            ayah: ayah.ayah,
            start: item.start,
            ...(Number.isFinite(item.end) ? { end: item.end } : {}),
            text: ayah.text,
          } satisfies Timestamp;
        })
        .filter((timestamp): timestamp is Timestamp => Boolean(timestamp))
        .sort(compareAyahPosition);
    },
    [],
  );

  const applyRange = useCallback(
    async (range: AyahRange, importedItems?: ImportTimestamp[], fallbackSurah?: number) => {
      if (
        range.startSurah > range.endSurah ||
        (range.startSurah === range.endSurah && range.startAyah > range.endAyah)
      ) {
        setRangeMessage("Start must come before end.");
        return;
      }

      setIsLoadingAyahs(true);
      setRangeMessage(null);
      setPreviewState(null);
      setPreviewMessage(null);

      try {
        const loadedAyahs = await loadAyahsForRange(range);
        const importedTimestamps = importedItems
          ? hydrateTimestamps(importedItems, loadedAyahs, fallbackSurah)
          : [];

        setAyahs(loadedAyahs);
        setLoadedRange(range);
        setRangeDraft(range);
        setTimestamps(importedTimestamps);
        setMarkHistory([]);
        setCurrentAyahKey(loadedAyahs[0]?.key ?? null);
        setImportMessage(
          importedItems ? `Imported ${importedTimestamps.length} timestamps.` : null,
        );
        setRangeMessage(`Loaded ${loadedAyahs.length} ayahs from ${formatRange(range)}.`);
      } catch {
        setRangeMessage("Could not load that Quran range. Check your connection and try again.");
      } finally {
        setIsLoadingAyahs(false);
      }
    },
    [hydrateTimestamps, setPreviewState],
  );

  useEffect(() => {
    async function fetchChapters() {
      try {
        const loadedChapters = await loadChapters();

        setChapters(loadedChapters);
      } catch {
        setChaptersError("Could not load surah names from the Quran API.");
      }
    }

    void fetchChapters();
  }, []);

  useEffect(() => {
    if (hasLoadedDefaultRangeRef.current) {
      return;
    }

    hasLoadedDefaultRangeRef.current = true;
    void applyRange(initialRange);
  }, [applyRange, initialRange]);

  useEffect(() => {
    return () => {
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      }
    };
  }, []);

  const advancePreviewIfNeeded = useCallback(
    (time: number) => {
      const currentPreviewState = previewStateRef.current;

      if (!currentPreviewState || time < currentPreviewState.end - 0.05) {
        return;
      }

      const nextIndex = currentPreviewState.index + 1;
      const nextKey = currentPreviewState.keys[nextIndex];

      if (!nextKey) {
        waveformRef.current?.pause();
        setPreviewState(null);
        return;
      }

      const nextSegment = getTimestampSegment(nextKey);

      if (!nextSegment) {
        waveformRef.current?.pause();
        setPreviewState(null);
        setPreviewMessage("Preview stopped because the next ayah has no complete segment.");
        return;
      }

      setPreviewState({
        keys: currentPreviewState.keys,
        index: nextIndex,
        end: nextSegment.end,
      });
      waveformRef.current?.seekToTime(nextSegment.start);
      waveformRef.current?.play();
    },
    [getTimestampSegment, setPreviewState],
  );

  useEffect(() => {
    advancePreviewRef.current = advancePreviewIfNeeded;
  }, [advancePreviewIfNeeded]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    advancePreviewRef.current(time);
  }, []);

  const startPreview = useCallback(
    (keys: string[]) => {
      const firstKey = keys[0];

      if (!firstKey) {
        setPreviewMessage("No completed ayahs are ready for preview.");
        return;
      }

      const segment = getTimestampSegment(firstKey);

      if (!segment) {
        setPreviewMessage(
          "This ayah needs an end time. Mark the next ayah start or press Mark End.",
        );
        return;
      }

      setPreviewMessage(null);
      setPreviewState({
        keys,
        index: 0,
        end: segment.end,
      });
      waveformRef.current?.seekToTime(segment.start);
      waveformRef.current?.play();
    },
    [getTimestampSegment, setPreviewState],
  );

  const handlePreviewAyah = useCallback(
    (key: string) => {
      startPreview([key]);
    },
    [startPreview],
  );

  const handlePreviewAll = useCallback(() => {
    const previewableKeys = ayahs
      .filter((ayah) => Number.isFinite(timestampByKey.get(ayah.key)?.end))
      .map((ayah) => ayah.key);

    startPreview(previewableKeys);
  }, [ayahs, startPreview, timestampByKey]);

  const handleTogglePlayback = useCallback(() => {
    setPreviewState(null);
    waveformRef.current?.togglePlayback();
  }, [setPreviewState]);

  const handleSeekBy = useCallback((seconds: number) => {
    setPreviewState(null);
    waveformRef.current?.seekBy(seconds);
  }, [setPreviewState]);

  const handleSeekBackward = useCallback(() => {
    handleSeekBy(-5);
  }, [handleSeekBy]);

  const handleSeekForward = useCallback(() => {
    handleSeekBy(5);
  }, [handleSeekBy]);

  const handleSeekToTimestamp = useCallback((seconds: number) => {
    setPreviewState(null);
    waveformRef.current?.seekToTime(seconds);
  }, [setPreviewState]);

  const handleSetCurrentAyah = useCallback((key: string) => {
    setCurrentAyahKey(key);
    setPreviewState(null);
  }, [setPreviewState]);

  const handleMarkAyah = useCallback(() => {
    const ayah = ayahs.find((item) => item.key === currentAyahKey);

    if (!ayah) {
      return;
    }

    const start = waveformRef.current?.getCurrentTime() ?? currentTime;
    const previousTimestamp = timestamps.find((timestamp) => timestamp.key === ayah.key);
    const previousEnd = previousTimestamp?.end;
    const nextTimestamp: Timestamp = {
      key: ayah.key,
      surah: ayah.surah,
      ayah: ayah.ayah,
      start,
      ...(typeof previousEnd === "number" && Number.isFinite(previousEnd) && previousEnd > start
        ? { end: previousEnd }
        : {}),
      text: ayah.text,
    };
    const updatedTimestamps = upsertTimestamp(timestamps, nextTimestamp);

    setTimestamps(updatedTimestamps);
    setMarkHistory((history) => [
      ...history,
      {
        key: ayah.key,
        previousTimestamps: timestamps,
      },
    ]);
    setCurrentAyahKey(ayah.key);
    setImportMessage(null);
    if (previousTimestamp) {
      setPreviewMessage(
        Number.isFinite(nextTimestamp.end)
          ? `Updated start for ayah ${ayah.surah}:${ayah.ayah}.`
          : `Updated start for ayah ${ayah.surah}:${ayah.ayah}. Mark its end again.`,
      );
    } else {
      setPreviewMessage(`Marked start for ayah ${ayah.surah}:${ayah.ayah}.`);
    }
  }, [ayahs, currentAyahKey, currentTime, timestamps]);

  const handleMarkEndAyah = useCallback(() => {
    const currentOpenTimestamp =
      timestamps.find(
        (timestamp) => timestamp.key === currentAyahKey && timestamp.end === undefined,
      ) ?? null;
    const latestOpenTimestamp =
      [...ayahs]
        .reverse()
        .map((ayah) => timestamps.find((timestamp) => timestamp.key === ayah.key))
        .find((timestamp) => timestamp && timestamp.end === undefined) ?? null;
    const currentTimestamp = currentOpenTimestamp ?? latestOpenTimestamp;

    if (!currentTimestamp) {
      setPreviewMessage("There is no open ayah start to end.");
      return;
    }

    const end = waveformRef.current?.getCurrentTime() ?? currentTime;

    if (end <= currentTimestamp.start) {
      setPreviewMessage("End time must be after the ayah start.");
      return;
    }

    setTimestamps((currentTimestamps) =>
      upsertTimestamp(currentTimestamps, {
        ...currentTimestamp,
        end,
      }),
    );
    setMarkHistory((history) => [
      ...history,
      {
        key: currentTimestamp.key,
        previousTimestamps: timestamps,
      },
    ]);
    setCurrentAyahKey(
      getNextPendingAyahKey(
        ayahs,
        upsertTimestamp(timestamps, {
          ...currentTimestamp,
          end,
        }),
        currentTimestamp.key,
      ),
    );
    setPreviewMessage(`Marked end for ayah ${currentTimestamp.surah}:${currentTimestamp.ayah}.`);
  }, [ayahs, currentAyahKey, currentTime, timestamps]);

  const handleUndo = useCallback(() => {
    const lastMark = markHistory.at(-1);

    if (!lastMark) {
      return;
    }

    setTimestamps(lastMark.previousTimestamps);
    setMarkHistory((history) => history.slice(0, -1));
    setCurrentAyahKey(lastMark.key);
    setImportMessage(null);
    setPreviewMessage(null);
  }, [markHistory]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  const handleAudioUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    audioObjectUrlRef.current = objectUrl;
    setAudioUrl(objectUrl);
    setAudioLabel(file.name);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPreviewState(null);
  }, [setPreviewState]);

  const handleImportJson = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      try {
        const payload = JSON.parse(await file.text()) as {
          range?: AyahRange;
          surah?: number;
          timestamps?: ImportTimestamp[];
        };

        if (payload.range) {
          await applyRange(payload.range, payload.timestamps ?? [], payload.surah);
        } else {
          const importedTimestamps = hydrateTimestamps(
            payload.timestamps ?? [],
            ayahs,
            payload.surah ?? loadedRange.startSurah,
          );

          setTimestamps(importedTimestamps);
          setCurrentAyahKey(getNextPendingAyahKey(ayahs, importedTimestamps, ayahs[0]?.key ?? ""));
          setMarkHistory([]);
          setImportMessage(`Imported ${importedTimestamps.length} timestamps.`);
        }
      } catch {
        setImportMessage("Could not import that JSON file.");
      } finally {
        event.target.value = "";
      }
    },
    [applyRange, ayahs, hydrateTimestamps, loadedRange.startSurah],
  );

  const updateRangeDraft = useCallback(
    (patch: Partial<AyahRange>) => {
      setRangeDraft((current) => {
        const next = { ...current, ...patch };
        const startMax = getVerseCount(next.startSurah);
        const endMax = getVerseCount(next.endSurah);

        next.startAyah = Math.min(Math.max(next.startAyah, 1), startMax);
        next.endAyah = Math.min(Math.max(next.endAyah, 1), endMax);

        return next;
      });
    },
    [getVerseCount],
  );

  useTimestampShortcuts({
    onTogglePlayback: handleTogglePlayback,
    onMark: handleMarkAyah,
    onSeekBackward: handleSeekBackward,
    onSeekForward: handleSeekForward,
    onUndo: handleUndo,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-700">
              Quran Tafseer Timestamp Editor
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
              {currentRangeTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              API text from Quran.com. Audio and timestamps stay local in the browser.
            </p>
          </div>

          <div className="min-w-64">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Progress</span>
              <span>
                {completedCount} / {totalAyahs} ayahs completed
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>From surah</span>
                <select
                  value={rangeDraft.startSurah}
                  onChange={(event) =>
                    updateRangeDraft({ startSurah: Number(event.target.value) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 transition focus:ring-2"
                >
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.id}. {chapter.nameSimple}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>From ayah</span>
                <input
                  type="number"
                  min={1}
                  max={getVerseCount(rangeDraft.startSurah)}
                  value={rangeDraft.startAyah}
                  onChange={(event) =>
                    updateRangeDraft({ startAyah: Number(event.target.value) })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 transition focus:ring-2"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>To surah</span>
                <select
                  value={rangeDraft.endSurah}
                  onChange={(event) => updateRangeDraft({ endSurah: Number(event.target.value) })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 transition focus:ring-2"
                >
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.id}. {chapter.nameSimple}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>To ayah</span>
                <input
                  type="number"
                  min={1}
                  max={getVerseCount(rangeDraft.endSurah)}
                  value={rangeDraft.endAyah}
                  onChange={(event) => updateRangeDraft({ endAyah: Number(event.target.value) })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 transition focus:ring-2"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void applyRange(rangeDraft);
                }}
                disabled={isLoadingAyahs || chapters.length === 0}
                className="rounded-xl bg-slate-950 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingAyahs ? "Loading Quran..." : "Load Quran Range"}
              </button>
              {chaptersError ? <span className="text-sm text-rose-600">{chaptersError}</span> : null}
              {rangeMessage ? <span className="text-sm text-slate-500">{rangeMessage}</span> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Load tafseer audio file</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:font-semibold file:text-white"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Import timestamp JSON</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    void handleImportJson(event);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:font-semibold file:text-white"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>Audio: {audioLabel}</span>
              {importMessage ? <span className="text-teal-700">{importMessage}</span> : null}
            </div>
          </div>

          <Waveform
            ref={waveformRef}
            audioUrl={audioUrl}
            playbackRate={playbackRate}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setDuration}
            onPlaybackChange={setIsPlaying}
          />

          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            disabled={!audioUrl}
            onTogglePlayback={handleTogglePlayback}
            onPlaybackRateChange={handlePlaybackRateChange}
            onSeekBy={handleSeekBy}
          />

          <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Next mark
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {currentAyah ? `Ayah ${currentAyah.surah}:${currentAyah.ayah}` : "No ayah loaded"}
                </h2>
                {currentTimestamp ? (
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    {currentAyahIsDone
                      ? "Completed. Move audio to a new time and click Update Start to change it."
                      : "Start marked. Click Mark End when this ayah explanation finishes."}
                  </p>
                ) : null}
                <p className="mt-2 text-right text-xl leading-loose text-slate-900" dir="rtl">
                  {currentAyah?.text ?? "Load a Quran range to begin."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                <button
                  type="button"
                  onClick={handleMarkAyah}
                  disabled={!audioUrl || !currentAyah}
                  className="rounded-2xl bg-teal-600 px-8 py-4 text-lg font-black text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {currentAyahIsDone
                    ? "Update Start (M)"
                    : currentAyahIsStarted
                      ? "Update Start (M)"
                      : "Mark Start (M)"}
                </button>
                <button
                  type="button"
                  onClick={handleMarkEndAyah}
                  disabled={!audioUrl || !hasOpenTimestamp}
                  className="rounded-2xl border border-teal-300 bg-white px-8 py-3 font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark End
                </button>
                <button
                  type="button"
                  onClick={handlePreviewAll}
                  disabled={!audioUrl || exportableTimestamps.length === 0}
                  className="rounded-2xl border border-amber-300 bg-amber-50 px-8 py-3 font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Play Preview
                </button>
                <button
                  type="button"
                  onClick={() => downloadTimestampJson(loadedRange, exportableTimestamps)}
                  className="rounded-2xl border border-slate-300 bg-white px-8 py-3 font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Export JSON
                </button>
              </div>
            </div>

            {previewMessage ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800">
                {previewMessage}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white px-3 py-1">Space: play/pause</span>
              <span className="rounded-full bg-white px-3 py-1">M: mark selected ayah start</span>
              <span className="rounded-full bg-white px-3 py-1">Click ayah: select/seek</span>
              <span className="rounded-full bg-white px-3 py-1">
                Long press ayah: preview
              </span>
              <span className="rounded-full bg-white px-3 py-1">← / →: seek 5s</span>
              <span className="rounded-full bg-white px-3 py-1">Buttons: seek 1s or 5s</span>
              <span className="rounded-full bg-white px-3 py-1">Backspace: undo</span>
            </div>
          </div>
        </div>

        <AyahList
          ayahs={ayahs}
          timestamps={timestamps}
          activeAyahKey={activeAyahKey}
          previewAyahKey={previewState?.keys[previewState.index] ?? null}
          onSeekToTimestamp={handleSeekToTimestamp}
          onSetCurrentAyah={handleSetCurrentAyah}
          onPreviewAyah={handlePreviewAyah}
        />
      </section>
    </main>
  );
}
