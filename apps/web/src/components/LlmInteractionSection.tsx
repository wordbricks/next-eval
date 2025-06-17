"use client";

import { activeExtractTabAtom } from "@/atoms/shared";
import { useAtom } from "jotai";
import { LlmTab } from "./LlmTab";
import { MdrTab } from "./MdrTab";

interface LlmInteractionSectionProps {
  isLoading: boolean;
}

export function LlmInteractionSection({
  isLoading,
}: LlmInteractionSectionProps) {
  const [activeExtractTab, setActiveExtractTab] = useAtom(activeExtractTabAtom);

  return (
    <section className="mt-8 rounded-lg border bg-white p-6 shadow-md">
      <h2 className="mb-4 font-semibold text-2xl">2. Extract data records</h2>
      <p className="mb-6 text-gray-600">
        Select your extraction method—an LLM model or the traditional MDR
        algorithm—and experiment with different HTML processing techniques to
        find the most effective combination.
      </p>

      {/* Tab Navigation */}
      <div className="mb-6 border-gray-200 border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveExtractTab("llm")}
            className={`whitespace-nowrap border-b-2 px-1 py-3 font-medium text-sm ${
              activeExtractTab === "llm"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            } focus:outline-hidden`}
            aria-current={activeExtractTab === "llm" ? "page" : undefined}
          >
            LLM
          </button>
          <button
            type="button"
            onClick={() => setActiveExtractTab("mdr")}
            className={`whitespace-nowrap border-b-2 px-1 py-3 font-medium text-sm ${
              activeExtractTab === "mdr"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            } focus:outline-hidden`}
            aria-current={activeExtractTab === "mdr" ? "page" : undefined}
          >
            MDR Algorithm
          </button>
        </nav>
      </div>
      {/* LLM Tab Content */}
      {activeExtractTab === "llm" && <LlmTab isProcessing={isLoading} />}
      {/* MDR Tab Content */}
      {activeExtractTab === "mdr" && <MdrTab isProcessing={isLoading} />}
    </section>
  );
}
