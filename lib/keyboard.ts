import { useEffect } from "react";

type TimestampShortcuts = {
  onTogglePlayback: () => void;
  onMark: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onUndo: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function useTimestampShortcuts({
  onTogglePlayback,
  onMark,
  onSeekBackward,
  onSeekForward,
  onUndo,
}: TimestampShortcuts) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onTogglePlayback();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        onMark();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSeekBackward();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSeekForward();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        onUndo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onMark, onSeekBackward, onSeekForward, onTogglePlayback, onUndo]);
}
