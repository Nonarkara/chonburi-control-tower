import { useEffect, useState } from "react";

/**
 * `navigator.onLine` reflected as React state, kept in sync with the
 * browser's online / offline events. Used by the offline banner so the
 * operator knows feeds are stalled because of their connection, not the
 * server.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return online;
}
