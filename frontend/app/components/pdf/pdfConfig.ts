"use client";

import { pdfjs } from "react-pdf";

// Use the pdfjs version react-pdf is bundling and load the matching ES module worker.
// The *.mjs file aligns with the dynamic import used by pdfjs-dist.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
