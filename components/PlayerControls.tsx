"use client";

import { formatClockTime } from "@/lib/time";

const playbackRates = [0.5, 1, 1.5, 2];

type PlayerControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  disabled?: boolean;
  onTogglePlayback: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onSeekBy: (seconds: number) => void;
};

export default function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  disabled = false,
  onTogglePlayback,
  onPlaybackRateChange,
  onSeekBy,
}: PlayerControlsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlayback}
            disabled={disabled}
            className="rounded-full bg-teal-600 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <div className="font-mono text-sm text-slate-600">
            {formatClockTime(currentTime)} / {formatClockTime(duration)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSeekBy(-1)}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -1s
          </button>
          <button
            type="button"
            onClick={() => onSeekBy(-5)}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -5s
          </button>
          <button
            type="button"
            onClick={() => onSeekBy(5)}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +5s
          </button>
          <button
            type="button"
            onClick={() => onSeekBy(1)}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +1s
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
        <span>Playback speed</span>
        <select
          value={playbackRate}
          onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-teal-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-40"
        >
          {playbackRates.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
