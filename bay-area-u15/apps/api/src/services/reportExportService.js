"use strict";

const { chromium } = require("playwright");

let browserPromise = null;

function createHttpError(message, statusCode = 500, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function sanitizeFilename(value, fallback = "report") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

async function buildPdfBufferFromHtml(options) {
  const html = String(options?.html || "");
  if (!html.trim()) {
    throw createHttpError("A standalone report HTML payload is required before a PDF can be generated.", 400);
  }

  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 2200,
    },
  });

  try {
    await page.emulateMedia({ media: "screen" });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0.3in",
        right: "0.25in",
        bottom: "0.3in",
        left: "0.25in",
      },
      displayHeaderFooter: false,
    });
  } catch (error) {
    throw createHttpError(
      error instanceof Error ? error.message : "The standalone PDF could not be generated right now.",
      500
    );
  } finally {
    await page.close().catch(() => {});
  }
}

async function sendPdfEmail(options) {
  const targetEmail = String(options?.to || "").trim();
  if (!isValidEmail(targetEmail)) {
    throw createHttpError("Provide a valid email address before sending the PDF report.", 400);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw createHttpError("RESEND_API_KEY is not configured for report delivery.", 503);
  }

  const pdfBuffer = await buildPdfBufferFromHtml({
    html: options?.reportHtml,
  });

  const fromAddress = process.env.REPORT_EMAIL_FROM || "Game-Changrs <noreply@game-changrs.com>";
  const subject = String(options?.subject || "Game-Changrs report PDF").trim();
  const filename = `${sanitizeFilename(options?.filename, "report")}.pdf`;
  const messageHtml = String(
    options?.messageHtml
      || `<p>Your Game-Changrs report PDF is attached to this email.</p>`
  );
  const messageText = String(options?.messageText || "Your Game-Changrs report PDF is attached to this email.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [targetEmail],
      subject,
      html: messageHtml,
      text: messageText,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.message === "string" && payload.message
        ? payload.message
        : `Report email failed with status ${response.status}.`;
    throw createHttpError(detail, response.status, payload);
  }

  return {
    id: payload?.id || null,
    email: targetEmail,
    filename,
  };
}

module.exports = {
  buildPdfBufferFromHtml,
  sanitizeFilename,
  sendPdfEmail,
};
