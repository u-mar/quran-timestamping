"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import WaveSurfer from "wavesurfer.js";

export type WaveformHandle = {
  togglePlayback: () => void;
  play: () => void;
  pause: () => void;
  seekBy: (seconds: number) => void;
  seekToTime: (seconds: number) => void;
  getCurrentTime: () => number;
};

type WaveformProps = {
  audioUrl: string;
  playbackRate: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlaybackChange: (isPlaying: boolean) => void;
};

const Waveform = forwardRef<WaveformHandle, WaveformProps>(function Waveform(
  { audioUrl, playbackRate, onTimeUpdate, onDurationChange, onPlaybackChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const playbackRateRef = useRef(playbackRate);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      togglePlayback() {
        void wavesurferRef.current?.playPause();
      },
      play() {
        void wavesurferRef.current?.play();
      },
      pause() {
        wavesurferRef.current?.pause();
      },
      seekBy(seconds) {
        const wavesurfer = wavesurferRef.current;

        if (!wavesurfer) {
          return;
        }

        const duration = wavesurfer.getDuration();
        const nextTime = Math.min(
          Math.max(wavesurfer.getCurrentTime() + seconds, 0),
          duration || 0,
        );

        wavesurfer.setTime(nextTime);
      },
      seekToTime(seconds) {
        const wavesurfer = wavesurferRef.current;

        if (!wavesurfer) {
          return;
        }

        const duration = wavesurfer.getDuration();
        wavesurfer.setTime(Math.min(Math.max(0, seconds), duration || seconds));
      },
      getCurrentTime() {
        return wavesurferRef.current?.getCurrentTime() ?? 0;
      },
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !audioUrl) {
      return;
    }

    setError(null);

    const wavesurfer = WaveSurfer.create({
      container,
      url: audioUrl,
      height: 96,
      barGap: 2,
      barRadius: 2,
      barWidth: 2,
      cursorColor: "#0f766e",
      progressColor: "#0d9488",
      waveColor: "#cbd5e1",
      normalize: true,
    });

    wavesurferRef.current = wavesurfer;
    wavesurfer.setPlaybackRate(playbackRateRef.current);

    const unsubscribers = [
      wavesurfer.on("ready", (duration) => {
        onDurationChange(duration);
        onTimeUpdate(wavesurfer.getCurrentTime());
      }),
      wavesurfer.on("timeupdate", (time) => {
        onTimeUpdate(time);
      }),
      wavesurfer.on("play", () => {
        onPlaybackChange(true);
      }),
      wavesurfer.on("pause", () => {
        onPlaybackChange(false);
      }),
      wavesurfer.on("finish", () => {
        onPlaybackChange(false);
      }),
      wavesurfer.on("error", () => {
        setError("Audio could not be loaded. Try uploading a local audio file.");
        onPlaybackChange(false);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      wavesurfer.destroy();
      wavesurferRef.current = null;
      onPlaybackChange(false);
      onDurationChange(0);
      onTimeUpdate(0);
    };
  }, [audioUrl, onDurationChange, onPlaybackChange, onTimeUpdate]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    wavesurferRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div ref={containerRef} className="min-h-24" />
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {!audioUrl ? (
        <p className="text-sm text-slate-500">Upload an audio file to start timestamping.</p>
      ) : null}
    </div>
  );
});

export default Waveform;
