import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function sanitizeDownloadFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report"
  );
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const finalize = () => {
      image.removeEventListener("load", finalize);
      image.removeEventListener("error", finalize);
      resolve();
    };

    image.addEventListener("load", finalize);
    image.addEventListener("error", finalize);
  });
}

async function waitForFrameContent(frame: HTMLIFrameElement) {
  const reportDocument = frame.contentDocument;
  const reportWindow = frame.contentWindow;
  if (!reportDocument || !reportWindow) {
    throw new Error("The standalone report is not ready yet.");
  }

  if (reportDocument.fonts?.ready) {
    await reportDocument.fonts.ready.catch(() => undefined);
  }

  await Promise.all(Array.from(reportDocument.images).map((image) => waitForImage(image)));
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  return { reportDocument, reportWindow };
}

function stripZeroSizeCanvases(document: Document) {
  document.querySelectorAll("canvas").forEach((canvas) => {
    const measuredWidth = canvas.width || canvas.clientWidth || canvas.getBoundingClientRect().width || 0;
    const measuredHeight = canvas.height || canvas.clientHeight || canvas.getBoundingClientRect().height || 0;

    if (measuredWidth > 0 && measuredHeight > 0) {
      return;
    }

    canvas.remove();
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The generated PDF could not be encoded for email."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function renderReportFramePdf(frame: HTMLIFrameElement, fileNameBase: string) {
  const { reportDocument, reportWindow } = await waitForFrameContent(frame);
  const captureRoot = reportDocument.body;
  if (!captureRoot) {
    throw new Error("The standalone report content is not available yet.");
  }

  const captureWidth = Math.max(
    captureRoot.scrollWidth,
    reportDocument.documentElement.scrollWidth,
    reportWindow.innerWidth,
  );
  const captureHeight = Math.max(
    captureRoot.scrollHeight,
    reportDocument.documentElement.scrollHeight,
    reportWindow.innerHeight,
  );
  if (captureWidth <= 0 || captureHeight <= 0) {
    throw new Error("The standalone report dimensions are not ready yet.");
  }

  const canvas = await html2canvas(captureRoot, {
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
    allowTaint: false,
    scale: Math.max(1.25, Math.min(window.devicePixelRatio || 1, 2)),
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      stripZeroSizeCanvases(clonedDocument);

      const clonedHtml = clonedDocument.documentElement;
      const clonedBody = clonedDocument.body;
      if (clonedHtml) {
        clonedHtml.style.height = "auto";
        clonedHtml.style.minHeight = "0";
        clonedHtml.style.overflow = "visible";
      }
      if (clonedBody) {
        clonedBody.style.height = "auto";
        clonedBody.style.minHeight = "0";
        clonedBody.style.overflow = "visible";
      }
    },
  });

  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pagePixelHeight = Math.max(1, Math.floor((pageHeight / pageWidth) * canvas.width));

  let currentOffset = 0;
  let pageIndex = 0;

  while (currentOffset < canvas.height) {
    const sliceHeight = Math.min(pagePixelHeight, canvas.height - currentOffset);
    const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
    const isLastPage = currentOffset + sliceHeight >= canvas.height;

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceCanvas = reportDocument.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;

    const sliceContext = sliceCanvas.getContext("2d");
    if (!sliceContext) {
      throw new Error("The PDF canvas context could not be created.");
    }

    sliceContext.fillStyle = "#ffffff";
    sliceContext.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceContext.drawImage(
      canvas,
      0,
      currentOffset,
      canvas.width,
      sliceHeight,
      0,
      0,
      sliceCanvas.width,
      sliceCanvas.height,
    );

    const imageData = sliceCanvas.toDataURL("image/jpeg", 0.98);
    pdf.internal.pageSize.setWidth(pageWidth);
    pdf.internal.pageSize.setHeight(isLastPage && renderedHeight < pageHeight ? renderedHeight : pageHeight);
    const currentPageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(6, 19, 28);
    pdf.rect(0, 0, pageWidth, currentPageHeight, "F");

    pdf.addImage(imageData, "JPEG", 0, 0, pageWidth, renderedHeight, undefined, "FAST");

    currentOffset += sliceHeight;
    pageIndex += 1;
  }

  const blob = pdf.output("blob");

  return {
    blob,
    base64: await blobToBase64(blob),
    filename: `${sanitizeDownloadFilename(fileNameBase)}.pdf`,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
