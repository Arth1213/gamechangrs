import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PDF_MARGIN_PT = 18;
const PDF_FILL_RGB = {
  red: 6,
  green: 19,
  blue: 28,
};
const PAGE_HEIGHT_BUFFER_PX = 28;

type ExportShellKind = "assessment" | "intelligence" | "generic";

type ExportBlock = {
  element: HTMLElement;
  extraTopSpacingPx?: number;
};

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

function makeAssessmentDonutsPdfSafe(document: Document) {
  const pdfSafeStyle = document.createElement("style");
  pdfSafeStyle.textContent = `
    .pdf-safe-donut-ring {
      background: linear-gradient(180deg, rgba(49, 199, 191, 0.18), rgba(103, 183, 255, 0.18)) !important;
      border: 12px solid rgba(103, 183, 255, 0.5) !important;
      box-shadow: inset 0 0 0 1px rgba(145, 192, 215, 0.14) !important;
    }

    .pdf-safe-donut-ring::after {
      width: 68px !important;
      height: 68px !important;
      background: #0d2230 !important;
      box-shadow: inset 0 0 0 1px rgba(145, 192, 215, 0.12) !important;
    }
  `;
  document.head.appendChild(pdfSafeStyle);

  document.querySelectorAll<HTMLElement>(".donut-ring").forEach((ring) => {
    ring.classList.add("pdf-safe-donut-ring");
    ring.style.background = "linear-gradient(180deg, rgba(49, 199, 191, 0.18), rgba(103, 183, 255, 0.18))";
  });
}

function applyCloneAdjustments(document: Document) {
  stripZeroSizeCanvases(document);
  makeAssessmentDonutsPdfSafe(document);

  const clonedHtml = document.documentElement;
  const clonedBody = document.body;
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
}

function resolveExportShell(document: Document) {
  const assessmentShell = document.querySelector<HTMLElement>(".report-sheet");
  if (assessmentShell) {
    return {
      kind: "assessment" as const,
      shell: assessmentShell,
    };
  }

  const intelligenceShell = document.querySelector<HTMLElement>(".page-shell.intelligence-shell");
  if (intelligenceShell) {
    return {
      kind: "intelligence" as const,
      shell: intelligenceShell,
    };
  }

  return {
    kind: "generic" as const,
    shell: document.body,
  };
}

function measureOuterHeight(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.height
    + Number.parseFloat(style.marginTop || "0")
    + Number.parseFloat(style.marginBottom || "0")
  );
}

function collectExportBlocks(kind: ExportShellKind, shell: HTMLElement) {
  if (kind === "assessment") {
    return Array.from(shell.children).flatMap((child) => {
      if (!(child instanceof HTMLElement)) {
        return [];
      }

      if (child.classList.contains("details-shell")) {
        return Array.from(child.children)
          .filter((detailChild): detailChild is HTMLElement => detailChild instanceof HTMLElement)
          .map((detailChild) => ({
            element: detailChild,
            extraTopSpacingPx: 18,
          }));
      }

      return [{ element: child }];
    });
  }

  if (kind === "intelligence") {
    return Array.from(shell.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("sheet"))
      .map((element) => ({ element }));
  }

  return [{ element: shell }];
}

async function resolveElementDimensions(element: HTMLElement, captureWidth: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const bounds = element.getBoundingClientRect();
    const width = Math.max(
      Math.ceil(bounds.width),
      Math.ceil(element.scrollWidth),
      Math.ceil(element.offsetWidth),
      Math.ceil(element.clientWidth),
      Math.ceil(captureWidth),
    );
    const height = Math.max(
      Math.ceil(bounds.height),
      Math.ceil(element.scrollHeight),
      Math.ceil(element.offsetHeight),
      Math.ceil(element.clientHeight),
    );

    if (width > 0 && height > 0) {
      return { width, height };
    }

    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }

  throw new Error("The standalone report page dimensions are not ready yet.");
}

async function renderElementCanvas(element: HTMLElement, captureWidth: number) {
  const { width, height } = await resolveElementDimensions(element, captureWidth);

  return html2canvas(element, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    allowTaint: false,
    scale: Math.max(1.25, Math.min(window.devicePixelRatio || 1, 2)),
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (element) => {
      if (element instanceof HTMLCanvasElement) {
        const elementWidth = element.width || element.clientWidth || element.getBoundingClientRect().width || 0;
        const elementHeight = element.height || element.clientHeight || element.getBoundingClientRect().height || 0;
        return elementWidth <= 0 || elementHeight <= 0;
      }

      return false;
    },
    onclone: (clonedDocument) => {
      applyCloneAdjustments(clonedDocument);
    },
  });
}

function fillPdfPage(pdf: jsPDF, pageWidth: number, pageHeight: number) {
  pdf.setFillColor(PDF_FILL_RGB.red, PDF_FILL_RGB.green, PDF_FILL_RGB.blue);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  innerWidth: number,
  innerHeight: number,
  isFirstPdfPage: boolean,
) {
  const slicePixelHeight = Math.max(1, Math.floor((innerHeight / innerWidth) * canvas.width));
  let offsetY = 0;
  let hasWrittenPage = isFirstPdfPage;

  while (offsetY < canvas.height) {
    const currentSliceHeight = Math.min(slicePixelHeight, canvas.height - offsetY);
    const renderedHeight = (currentSliceHeight * innerWidth) / canvas.width;

    if (hasWrittenPage) {
      pdf.addPage();
    }

    fillPdfPage(pdf, pageWidth, pageHeight);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentSliceHeight;

    const sliceContext = sliceCanvas.getContext("2d");
    if (!sliceContext) {
      throw new Error("The PDF canvas context could not be created.");
    }

    sliceContext.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceContext.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      sliceCanvas.width,
      sliceCanvas.height,
    );

    const imageData = sliceCanvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imageData, "JPEG", PDF_MARGIN_PT, PDF_MARGIN_PT, innerWidth, renderedHeight, undefined, "FAST");

    offsetY += currentSliceHeight;
    hasWrittenPage = true;
  }

  return hasWrittenPage;
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

  const { kind, shell } = resolveExportShell(reportDocument);
  const shellRect = shell.getBoundingClientRect();
  const captureWidth = Math.max(
    Math.ceil(shellRect.width),
    Math.ceil(shell.scrollWidth),
    Math.ceil(captureRoot.scrollWidth),
    Math.ceil(reportDocument.documentElement.scrollWidth),
    Math.ceil(reportWindow.innerWidth),
  );
  if (captureWidth <= 0) {
    throw new Error("The standalone report dimensions are not ready yet.");
  }

  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const innerWidth = pageWidth - (PDF_MARGIN_PT * 2);
  const innerHeight = pageHeight - (PDF_MARGIN_PT * 2);
  const blocks = collectExportBlocks(kind, shell);

  let hasWrittenPdfPage = false;

  await new Promise((resolve) => window.setTimeout(resolve, 80));

  for (const block of blocks) {
    const blockCanvas = await renderElementCanvas(block.element, captureWidth);
    hasWrittenPdfPage = addCanvasToPdf(
      pdf,
      blockCanvas,
      pageWidth,
      pageHeight,
      innerWidth,
      innerHeight,
      hasWrittenPdfPage,
    );
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
