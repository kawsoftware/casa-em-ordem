import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader2 } from 'lucide-react';

// Configure worker via CDN to avoid local build/path resolution issues
// We use a generic recent version compatible with most react-pdf versions or match it to 4.x/5.x
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfThumbnail({ url }) {
    const [numPages, setNumPages] = useState(null);
    const [loading, setLoading] = useState(true);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setLoading(false);
    }

    function onDocumentLoadError(error) {
        // Detailed error logging might need to be removed in prod, but helpful now
        console.error("PDF Load Error:", error);
        setLoading(false);
    }

    return (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                    <div className="flex flex-col items-center text-gray-400 gap-2">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-xs">Gerando miniatura...</span>
                    </div>
                }
                error={
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-2 p-4 text-center h-full w-full">
                        <FileText size={32} className="text-gray-300 opacity-50" />
                        <span className="text-[10px] text-gray-400">Preview indisponível</span>
                    </div>
                }
                noData={
                    <div className="text-xs text-gray-400">Sem dados</div>
                }
                className="flex items-center justify-center w-full h-full"
            >
                <Page
                    pageNumber={1}
                    width={250}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                    error={<div>Erro Pag</div>}
                />
            </Document>

            {!loading && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-gray-600 shadow-sm border border-gray-200 flex items-center gap-1 pointer-events-none">
                    <FileText size={10} /> PDF
                </div>
            )}
        </div>
    );
}
