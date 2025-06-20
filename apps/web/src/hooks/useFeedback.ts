import {
  activeExtractTabAtom,
  feedbackSentAtom,
  htmlIdAtom,
} from "@/atoms/shared";
import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";

export const useFeedback = () => {
  const [feedbackSent, setFeedbackSent] = useAtom(feedbackSentAtom);
  const htmlId = useAtomValue(htmlIdAtom);
  const activeExtractTab = useAtomValue(activeExtractTabAtom);

  const getCurrentFeedbackId = useCallback(
    (tabOverride?: string) => {
      const tab = tabOverride || activeExtractTab;
      return `${htmlId}-${tab}`;
    },
    [htmlId, activeExtractTab],
  );

  const handleFeedback = useCallback(
    async (isPositive: boolean, tabOverride?: string) => {
      const id = getCurrentFeedbackId(tabOverride);
      if (feedbackSent[id]) {
        return;
      }

      const feedbackMessage = `*Extraction Feedback*\\n${isPositive ? "👍" : "👎"} ID: ${id}`;

      try {
        const response = await fetch("/next-eval/api/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: feedbackMessage }),
        });

        if (response.ok) {
          setFeedbackSent((prev) => ({ ...prev, [id]: true }));
        } else {
          console.error(
            "Failed to send feedback via API. Status:",
            response.status,
          );
          const responseBody = await response.text();
          console.error("Response body:", responseBody);
        }
      } catch (error) {
        console.error("Error sending feedback:", error);
      }
    },
    [getCurrentFeedbackId, feedbackSent, setFeedbackSent],
  );

  return {
    feedbackSent,
    handleFeedback,
    getCurrentFeedbackId,
  };
};
