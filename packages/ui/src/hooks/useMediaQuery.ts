import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string, defaultValue?: boolean) {
  const getSnapshot = () => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return defaultValue ?? false;
    }
    return window.matchMedia(query).matches;
  };

  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultValue ?? false,
  );
}
