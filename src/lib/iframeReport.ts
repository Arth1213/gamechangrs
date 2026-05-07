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

export async function waitForEmbeddedReport(frame: HTMLIFrameElement | null) {
  const reportDocument = frame?.contentDocument;
  if (!reportDocument) {
    throw new Error("The embedded report is not ready yet.");
  }

  if (reportDocument.fonts?.ready) {
    await reportDocument.fonts.ready.catch(() => undefined);
  }

  await Promise.all(Array.from(reportDocument.images).map((image) => waitForImage(image)));
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  return reportDocument;
}

export async function measureEmbeddedReportHeight(frame: HTMLIFrameElement | null, minimumHeight = 0) {
  const reportDocument = await waitForEmbeddedReport(frame);
  const documentHeight = Math.max(
    reportDocument.documentElement?.scrollHeight || 0,
    reportDocument.documentElement?.offsetHeight || 0,
    reportDocument.body?.scrollHeight || 0,
    reportDocument.body?.offsetHeight || 0,
    minimumHeight,
  );

  return Math.max(documentHeight, minimumHeight);
}
