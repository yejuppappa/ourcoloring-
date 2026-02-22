function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadPNG(dataUrl: string): void {
  triggerDownload(dataUrl, `ourcoloring_${Date.now()}.png`);
}

export async function downloadPDF(dataUrl: string): Promise<void> {
  const { jsPDF } = await import("jspdf");

  // A4: 210 x 297 mm
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const areaW = pageW - 2 * margin;
  const areaH = pageH - 2 * margin - 10; // reserve 10mm for watermark

  // Get image dimensions
  const img = await loadImageElement(dataUrl);
  const ratio = img.naturalWidth / img.naturalHeight;
  let imgW = areaW;
  let imgH = imgW / ratio;

  if (imgH > areaH) {
    imgH = areaH;
    imgW = imgH * ratio;
  }

  // Center image
  const x = (pageW - imgW) / 2;
  const y = margin + (areaH - imgH) / 2;

  pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH);

  // Watermark
  pdf.setFontSize(8);
  pdf.setTextColor(180, 180, 180);
  pdf.text("ourcoloring.com", pageW / 2, pageH - 8, { align: "center" });

  pdf.save(`ourcoloring_${Date.now()}.pdf`);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
