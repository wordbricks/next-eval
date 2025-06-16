import { type EffectCallback, useEffect, useRef } from "react";

export function useEffectOnce(effect: EffectCallback) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    return effect();
  }, [effect]);
}
