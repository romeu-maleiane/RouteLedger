// @ts-ignore
import html2pdf from "html2pdf.js";

export async function exportLogsToPDF(elementId: string, fileName = "fmcsa-driver-daily-logs.pdf") {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const opt = {
    margin: 10,
    filename: fileName,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" as const },
    pagebreak: { mode: ["css", "legacy"] },
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.warn("html2pdf encountered an issue, falling back to window.print():", err);
    window.print();
  }
}
