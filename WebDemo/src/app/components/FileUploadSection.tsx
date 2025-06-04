import type React from 'react';
import { type RefObject } from 'react';
import DownloadIcon from '../../components/icons/DownloadIcon';
import type { HtmlResult } from '../../lib/interfaces';
import { handleDownload } from '../../lib/utils/handleDownload';
import type { LlmAllResponses } from '../types';

interface FileUploadSectionProps {
  selectedFile: File | null;
  isLoading: boolean;
  processedData: HtmlResult | null;
  errorMessage: string | null;
  selectedStage: keyof LlmAllResponses;
  overallLlmFetching: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadSyntheticData: () => void;
  onStageSelect: (stage: keyof LlmAllResponses) => void;
}

export default function FileUploadSection({
  selectedFile,
  isLoading,
  processedData,
  errorMessage,
  selectedStage,
  overallLlmFetching,
  fileInputRef,
  onFileChange,
  onLoadSyntheticData,
  onStageSelect,
}: FileUploadSectionProps) {
  return (
    <section className="mb-8 p-6 border rounded-lg shadow-md bg-white">
      <h2 className="text-2xl font-semibold mb-4">
        1.Upload and process HTML
      </h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Upload your own HTML file.
          </p>
          <button
            type="button"
            onClick={onLoadSyntheticData}
            className="px-4 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || overallLlmFetching}
            aria-label="Load sample HTML data"
          >
            Load sample
          </button>
        </div>
        <input
          type="file"
          aria-label="Upload HTML or MHTML file"
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-orange-50 file:text-orange-600
            hover:file:bg-orange-100
            focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
            p-2 border border-gray-300 rounded-md shadow-sm"
          accept=".html"
          onChange={onFileChange}
          disabled={isLoading || overallLlmFetching}
          ref={fileInputRef}
        />
      </div>
      {errorMessage && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          Error: {errorMessage}
        </p>
      )}

      {processedData?.originalHtml && !isLoading && (
        <div className="mt-8">
          <div className="w-full p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium">Original HTML</h3>
              <button
                type="button"
                onClick={() =>
                  handleDownload(
                    processedData.originalHtml,
                    'original_html.html',
                    'text/html',
                  )
                }
                className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-full transition-colors duration-150 ease-in-out"
                aria-label="Download original HTML"
              >
                <DownloadIcon />
              </button>
            </div>
            <div>
              <div className="h-32 overflow-auto bg-white p-2 border rounded mb-3">
                <pre className="text-xs whitespace-pre-wrap">
                  {processedData.originalHtml}
                </pre>
              </div>
              <p className="text-xs text-gray-500 text-right">
                {processedData.originalHtmlLength.toLocaleString()} characters
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing stages display */}
      {processedData && !isLoading && (
        <section className="my-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stage 1: Slimmed HTML */}
            <div
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'html' ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => onStageSelect('html')}
              onKeyDown={(e) => e.key === 'Enter' && onStageSelect('html')}
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'html'}
              aria-label="Select Slimmed HTML stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">1. Slimmed HTML</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(
                      processedData.html,
                      'slimmed_html.html',
                      'text/html',
                    );
                  }}
                  className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download slimmed HTML"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <div className="h-32 overflow-auto bg-white p-2 border rounded mb-3">
                  <pre className="text-xs whitespace-pre-wrap">
                    {processedData.html}
                  </pre>
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {processedData.htmlLength.toLocaleString()} characters
                </p>
              </div>
            </div>

            {/* Stage 2: Hierarchical JSON */}
            <div
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'textMap' ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => onStageSelect('textMap')}
              onKeyDown={(e) =>
                e.key === 'Enter' && onStageSelect('textMap')
              }
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'textMap'}
              aria-label="Select Hierarchical JSON stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">2. Hierarchical JSON</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(
                      JSON.stringify(processedData.textMap, null, 2),
                      'hierarchical_map.json',
                      'application/json',
                    );
                  }}
                  className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download hierarchical JSON map"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <div className="h-32 overflow-auto bg-white p-2 border rounded mb-3">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMap, null, 2)}
                  </pre>
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {processedData.textMapLength.toLocaleString()} characters
                </p>
              </div>
            </div>

            {/* Stage 3: Flat JSON */}
            <div
              className={`p-4 border rounded-lg shadow bg-gray-50 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ease-in-out ${selectedStage === 'textMapFlat' ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => onStageSelect('textMapFlat')}
              onKeyDown={(e) =>
                e.key === 'Enter' && onStageSelect('textMapFlat')
              }
              tabIndex={0}
              role="button"
              aria-pressed={selectedStage === 'textMapFlat'}
              aria-label="Select Flat JSON stage and view its content"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium">3. Flat JSON</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(
                      JSON.stringify(processedData.textMapFlat, null, 2),
                      'flat_map.json',
                      'application/json',
                    );
                  }}
                  className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-full transition-colors duration-150 ease-in-out"
                  aria-label="Download flat JSON map"
                >
                  <DownloadIcon />
                </button>
              </div>
              <div>
                <div className="h-32 overflow-auto bg-white p-2 border rounded mb-3">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(processedData.textMapFlat, null, 2)}
                  </pre>
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {processedData.textMapFlatLength.toLocaleString()}{' '}
                  characters
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg font-semibold animate-pulse">
              Processing file, please wait...
            </p>
          </div>
        </div>
      )}
    </section>
  );
}