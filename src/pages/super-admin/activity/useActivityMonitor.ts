import { useEffect, useRef, useState } from "react";
import { activityMonitorService, type ActivityMonitorFilters, type MonitorSnapshot } from "../../../services/activityMonitorService";

export const ACTIVITY_REFRESH_MS = 3_000;

export function useActivityMonitor(filters: ActivityMonitorFilters) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [companySnapshot, setCompanySnapshot] = useState<MonitorSnapshot | null>(null);
  const [pending, setPending] = useState<MonitorSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const pausedRef = useRef(false);
  const displayedRef = useRef<MonitorSnapshot | null>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    setLoading(true); setError(""); setSnapshot(null); setCompanySnapshot(null); setPending(null);
    displayedRef.current = null; pausedRef.current = false; setPaused(false);
    const filters = JSON.parse(key) as ActivityMonitorFilters;
    const page = filters.page || 1;
    let initialLoad = true;
    const run = async () => {
      if (running || controller.signal.aborted) return;
      if (timer) clearTimeout(timer);
      running = true;
      try {
        if (document.visibilityState !== "hidden") {
          const result = initialLoad || page === 1
            ? await activityMonitorService.list(filters, controller.signal)
            : await activityMonitorService.companySummary(filters, controller.signal);
          if (controller.signal.aborted) return;
          if (page === 1 && pausedRef.current && displayedRef.current) setPending(result);
          else if (initialLoad) {
            initialLoad = false;
            displayedRef.current = result;
            setSnapshot(result);
            setCompanySnapshot(result);
            setPending(null);
          } else if (page === 1) {
            displayedRef.current = result;
            setSnapshot(result);
            setCompanySnapshot(result);
            setPending(null);
          } else {
            setCompanySnapshot(result);
          }
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải hoạt động.");
      } finally {
        running = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(run, ACTIVITY_REFRESH_MS);
        }
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [key, revision]);

  const togglePaused = () => {
    const next = !pausedRef.current;
    pausedRef.current = next; setPaused(next);
    if (!next && pending) { displayedRef.current = pending; setSnapshot(pending); setCompanySnapshot(pending); setPending(null); }
  };
  return { snapshot, companySnapshot, error, loading, paused, togglePaused, refresh: () => setRevision((value) => value + 1),
    pendingCount: pending && snapshot ? Math.max(0, pending.total - snapshot.total) : 0 };
}
