import { useCallback, useEffect, useRef, useState } from "react";

export function useRetailFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const ownsFullscreen = useRef(false);
  const pending = useRef(false);
  const requested = useRef(false);
  const mounted = useRef(true);
  const exit = useCallback(async () => {
    requested.current = false;
    setFullscreen(false);
    if (ownsFullscreen.current && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Browser may already have exited. */ }
    }
    ownsFullscreen.current = false;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const changed = () => {
      if (!document.fullscreenElement) {
        requested.current = false;
        ownsFullscreen.current = false;
        setFullscreen(false);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exit();
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", keydown);
    return () => {
      mounted.current = false;
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", keydown);
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      ownsFullscreen.current = false;
    };
  }, [exit]);

  const toggleFullscreen = async () => {
    if (pending.current) return;
    if (fullscreen) return exit();
    requested.current = true;
    setFullscreen(true);
    // Fullscreen the document so dialogs and dropdowns rendered in portals stay visible.
    // The POS also fills the viewport when the browser does not support this API.
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      pending.current = true;
      try {
        await document.documentElement.requestFullscreen();
        if (mounted.current && requested.current) ownsFullscreen.current = true;
        else if (document.fullscreenElement === document.documentElement) await document.exitFullscreen();
      } catch { /* Keep the viewport-filling layout if native fullscreen is unavailable. */ }
      finally { pending.current = false; }
    }
  };
  return { fullscreen, toggleFullscreen };
}
