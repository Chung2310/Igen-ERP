import { useCallback, useEffect, useRef, useState } from "react";

export function useRetailFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const ownsFullscreen = useRef(false);
  const pending = useRef(false);

  const exit = useCallback(async () => {
    setFullscreen(false);
    if (ownsFullscreen.current && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Browser may already have exited. */ }
    }
    ownsFullscreen.current = false;
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        ownsFullscreen.current = false;
        setFullscreen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exit();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      ownsFullscreen.current = false;
    };
  }, [exit]);

  const toggleFullscreen = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      if (fullscreen) {
        await exit();
        return;
      }
      setFullscreen(true);
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        ownsFullscreen.current = true;
      }
    } catch {
      // The POS still fills the available viewport through its layout classes.
    } finally {
      pending.current = false;
    }
  };

  return { fullscreen, toggleFullscreen };
}
