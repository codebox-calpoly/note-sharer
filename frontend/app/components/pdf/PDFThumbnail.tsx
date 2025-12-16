"use client";

import { useState } from "react";
import { Document, Page } from "react-pdf";
import "./pdfConfig";

type PDFThumbnailProps = {
  fileUrl: string;
  width?: number;
};

export default function PDFThumbnail({ fileUrl, width = 200 }: PDFThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <div className="relative bg-gray-100 border rounded overflow-hidden" style={{ width }}>
      {!isLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
          Loading preview…
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center h-[260px] text-xs text-red-600 p-2 text-center">
          Failed to load preview
        </div>
      )}

      <div className={isLoaded ? "" : "opacity-0"}>
        <Document
          file={fileUrl}
          onLoadSuccess={() => setIsLoaded(true)}
          onLoadError={(err) => {
            console.error("PDF preview error", err);
            setLoadError("Failed to load PDF");
          }}
          loading={null}
          error={null}
        >
          <Page
            pageNumber={1}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}
