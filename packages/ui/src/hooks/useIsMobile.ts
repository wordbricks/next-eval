import { useMediaQuery } from "@ui/hooks/useMediaQuery";

const MOBILE_BREAKPOINT = 768;

export const useIsMobile = () => {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

  return useMediaQuery(
    query,
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
};
