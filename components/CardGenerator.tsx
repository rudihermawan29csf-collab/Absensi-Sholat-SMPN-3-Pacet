import React, { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Student } from '../types';
import { X, Printer, Download, Loader2, Moon } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CardGeneratorProps {
  students: Student[];
  onClose: () => void;
}

const CardGenerator: React.FC<CardGeneratorProps> = ({ students, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    setIsGenerating(true);
    // Wait slightly longer for fonts and layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // PDF Config
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Get all "page" elements we created
      const pages = printRef.current.querySelectorAll('.print-page');

      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        
        // Capture specific page
        const canvas = await html2canvas(pageElement, {
          scale: 2, // 2x scale for better text clarity
          useCORS: true,
          logging: false,
          backgroundColor: '#1e293b',
          width: 794, // Force A4 width in px (approx 210mm at 96dpi)
          windowWidth: 794,
          onclone: (clonedDoc) => {
            // Fix SVG sizing in clone if needed
            const svgs = clonedDoc.querySelectorAll('svg');
            svgs.forEach((svg) => {
               const bounds = svg.getBoundingClientRect();
               if (bounds.width && bounds.height) {
                  svg.setAttribute("width", bounds.width.toString());
                  svg.setAttribute("height", bounds.height.toString());
               }
            });
          }
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Add to PDF
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save('kartu-hero-smpn3pacet.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal membuat PDF. Silakan coba lagi atau gunakan tombol Print.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to chunk students into pages (e.g., 8 cards per A4 page)
  const CARDS_PER_PAGE = 8;
  const pages = [];
  for (let i = 0; i < students.length; i += CARDS_PER_PAGE) {
    pages.push(students.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[60] overflow-y-auto backdrop-blur-sm flex flex-col items-center">
      {/* Toolbar */}
      <div className="sticky top-0 w-full bg-slate-800 shadow-xl border-b border-white/10 p-4 flex justify-between items-center no-print z-50">
        <div>
          <h2 className="text-lg font-bold text-amber-400 font-gaming">LEGENDARY CARD GENERATOR</h2>
          <p className="text-xs text-slate-400">Total: {students.length} Heroes | {pages.length} Pages</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className={`bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-cyan-500 transition-colors shadow-lg border border-cyan-400/50 ${isGenerating ? 'opacity-75 cursor-wait' : ''}`}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
          <button 
            onClick={handlePrint}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-500 transition-colors shadow-lg border border-amber-400/50"
          >
            <Printer size={18} />
            Print
          </button>
          <button 
            onClick={onClose}
            className="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-600 transition-colors shadow-lg"
          >
            <X size={18} />
            Close
          </button>
        </div>
      </div>

      {/* Printable Area Wrapper */}
      <div className="flex-1 overflow-auto p-8 w-full flex justify-center bg-slate-900">
        <div ref={printRef} id="printable-area">
            {pages.map((pageStudents, pageIndex) => (
                <div 
                    key={pageIndex}
                    className="print-page bg-white relative mb-8 shadow-2xl overflow-hidden mx-auto"
                    style={{ 
                        width: '210mm', // Exact A4 Width
                        minHeight: '297mm', // Exact A4 Height
                        padding: '10mm',
                        backgroundColor: '#1e293b', // Match App Theme Background
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gridAutoRows: 'max-content',
                        gap: '10px',
                        pageBreakAfter: 'always'
                    }}
                >
                    {/* Background Pattern for whole page */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                         backgroundImage: 'radial-gradient(circle, #fbbf24 1px, transparent 1px)',
                         backgroundSize: '20px 20px'
                    }}></div>

                    {pageStudents.map((student) => {
                        const nameLength = student.name.length;
                        const fontSizeClass = nameLength > 25 ? 'text-[10px]' : nameLength > 18 ? 'text-[12px]' : 'text-sm';
                        
                        return (
                            <div 
                                key={student.id} 
                                className="relative overflow-hidden flex shadow-lg border border-amber-700/30 rounded-xl bg-[#0f172a]"
                                style={{
                                    height: '5.5cm',
                                    pageBreakInside: 'avoid'
                                }}
                            >
                                {/* --- BACKGROUND LAYERS --- */}
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#172554] to-slate-900 z-0"></div>
                                
                                {/* Big Crescent Moon */}
                                <div className="absolute -right-6 -top-6 text-amber-500/10 z-0 transform rotate-12">
                                    <Moon size={180} fill="currentColor" />
                                </div>
                                
                                {/* Decorative Borders */}
                                <div className="absolute inset-1 border border-amber-500/20 rounded-lg z-10 pointer-events-none"></div>
                                <div className="absolute top-0 left-0 p-1 z-10">
                                    <div className="w-6 h-6 border-t-2 border-l-2 border-amber-500/60 rounded-tl-lg"></div>
                                </div>
                                <div className="absolute bottom-0 right-0 p-1 z-10">
                                    <div className="w-6 h-6 border-b-2 border-r-2 border-amber-500/60 rounded-br-lg"></div>
                                </div>

                                {/* --- CONTENT --- */}
                                <div className="relative z-20 w-full h-full p-3 flex items-center gap-4">
                                    
                                    {/* LEFT: QR CODE - ENLARGED (Almost Half Card) */}
                                    <div className="shrink-0 flex flex-col items-center justify-center pl-1">
                                        <div className="bg-white p-2 rounded-xl border-4 border-amber-500/50 shadow-[0_0_15px_rgba(0,0,0,0.5)] relative" style={{ width: '135px', height: '135px' }}>
                                            <QRCode
                                                value={student.id}
                                                style={{ height: "100%", width: "100%" }}
                                                viewBox={`0 0 256 256`}
                                            />
                                        </div>
                                        <div className="mt-1.5 text-[8px] font-bold text-amber-400 tracking-[0.2em] bg-slate-900/90 px-3 py-0.5 rounded-full border border-amber-500/30 shadow-lg">
                                            SCAN HERE
                                        </div>
                                    </div>

                                    {/* RIGHT: INFO */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
                                        {/* Header */}
                                        <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
                                            <img 
                                                src="https://iili.io/fEhQpTX.png" 
                                                className="w-6 h-6 object-contain"
                                                alt="Logo"
                                            />
                                            <div className="flex flex-col leading-none">
                                                <span className="text-[9px] text-cyan-400 font-bold tracking-wider uppercase font-gaming">SMPN 3 PACET</span>
                                                <span className="text-[6px] text-slate-400 tracking-wide uppercase">Student Identity Card</span>
                                            </div>
                                        </div>

                                        {/* Name - OPTIMIZED FOR PDF GENERATION */}
                                        <div className="flex-grow flex items-center">
                                            <h2 
                                                className={`${fontSizeClass} font-gaming font-bold leading-tight uppercase`} 
                                                style={{ 
                                                    color: '#fde68a', // Amber-200 hex
                                                    textShadow: '2px 2px 0px #000000', // Solid black shadow, no blur for better PDF crispness
                                                    zIndex: 30,
                                                    letterSpacing: '0.05em'
                                                }}
                                            >
                                                {student.name}
                                            </h2>
                                        </div>

                                        {/* Footer Stats */}
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <div className="bg-slate-900/60 border border-amber-500/30 rounded px-1.5 py-0.5 flex flex-col">
                                                <span className="text-[5px] text-slate-500 uppercase tracking-widest">ID / NIS</span>
                                                <span className="text-[10px] text-amber-400 font-mono font-bold">{student.id}</span>
                                            </div>
                                            <div className="bg-slate-900/60 border border-cyan-500/30 rounded px-1.5 py-0.5 flex flex-col">
                                                <span className="text-[5px] text-slate-500 uppercase tracking-widest">Class</span>
                                                <span className="text-[10px] text-cyan-400 font-mono font-bold">{student.className}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default CardGenerator;