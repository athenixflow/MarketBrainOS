// Empty stand-in for jsPDF's optional renderers (html2canvas, canvg, dompurify). They only load when
// doc.html() or SVG drawing is used; services/pdfReport.ts uses neither, so vite.config.ts aliases
// them here to keep ~350KB of never-fetched chunks out of dist.
export default undefined;
