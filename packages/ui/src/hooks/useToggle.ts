import { useCallback, useState } from "react";

export const useToggle = (
  initialValue: unknown,
): [boolean, (value?: unknown) => void] => {
  const [on, setOn] = useState(() => {
    if (typeof initialValue === "boolean") {
      return initialValue;
    }

    return Boolean(initialValue);
  });

  const handleToggle = useCallback((value?: unknown) => {
    if (typeof value === "boolean") {
      return setOn(value);
    }

    return setOn((v) => !v);
  }, []);

  return [on, handleToggle] as const;
};
