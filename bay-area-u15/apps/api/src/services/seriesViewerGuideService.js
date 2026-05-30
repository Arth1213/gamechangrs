"use strict";

const fs = require("fs/promises");
const path = require("path");

const { normalizeText } = require("../lib/utils");

let guideHtmlPromise = null;

function createHttpError(message, statusCode = 500, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function normalizeEmail(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes("@") ? normalized : "";
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

function getSiteUrl() {
  const configured = [
    normalizeText(process.env.SITE_URL),
    normalizeText(process.env.APP_SITE_URL),
    normalizeText(process.env.REPORT_SITE_URL),
  ].find((value) => isValidHttpUrl(value));

  return (configured || "https://game-changrs.com").replace(/\/+$/, "");
}

function getSeriesViewerGuidePath() {
  return path.resolve(__dirname, "../../../../../public/analytics-samples/series-viewer-guide.html");
}

function getSeriesViewerGuidePublicUrl() {
  return `${getSiteUrl()}/analytics-samples/series-viewer-guide.html`;
}

async function loadSeriesViewerGuideHtml() {
  if (!guideHtmlPromise) {
    guideHtmlPromise = fs.readFile(getSeriesViewerGuidePath(), "utf8").catch((error) => {
      guideHtmlPromise = null;
      throw error;
    });
  }

  return guideHtmlPromise;
}

async function sendSeriesViewerGuideEmail(options) {
  const targetEmail = normalizeEmail(options?.to);
  if (!targetEmail) {
    throw createHttpError("A valid email address is required before sending the series viewer guide.", 400);
  }

  const resendApiKey = normalizeText(process.env.RESEND_API_KEY);
  if (!resendApiKey) {
    throw createHttpError("RESEND_API_KEY is not configured for analytics guide delivery.", 503);
  }

  const guideHtml = await loadSeriesViewerGuideHtml();
  const guideUrl = getSeriesViewerGuidePublicUrl();
  const fromAddress = normalizeText(process.env.REPORT_EMAIL_FROM) || "Game-Changrs <noreply@game-changrs.com>";
  const seriesName = normalizeText(options?.seriesName) || "your approved series";
  const accessRole = normalizeText(options?.accessRole).toLowerCase() === "analyst" ? "analyst" : "viewer";
  const filename = "game-changrs-analytics-series-viewer-guide.html";
  const subject = `Game-Changrs analytics access approved: ${seriesName}`;

  const messageHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <div style="padding: 24px; border-radius: 20px; background: linear-gradient(180deg, #0b1115 0%, #10171c 100%); color: #eff4f2;">
        <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #71b188;">
          Game-Changrs Analytics
        </div>
        <h1 style="margin: 14px 0 12px; font-size: 30px; line-height: 1.02;">
          Your series access is ready.
        </h1>
        <p style="margin: 0; color: #d1d9d5; line-height: 1.7;">
          Your email is approved for ${accessRole} access to <strong>${seriesName}</strong>.
          The attached HTML guide explains how to open the series, search players, and when to use
          <strong>Player Assessment</strong> versus <strong>Player Intelligence</strong>.
        </p>
      </div>
      <div style="margin-top: 18px; padding: 18px 20px; border: 1px solid #d6dfdb; border-radius: 18px; background: #f8fbf9;">
        <p style="margin: 0 0 10px; font-weight: 700;">Start with these steps:</p>
        <ol style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.75;">
          <li>Sign in with this approved email address.</li>
          <li>Open the Analytics workspace and choose <strong>${seriesName}</strong>.</li>
          <li>Search the player and open the report that matches your decision.</li>
        </ol>
      </div>
      <p style="margin: 18px 0 0; color: #475569; line-height: 1.7;">
        Attached: <strong>${filename}</strong><br />
        Browser copy: <a href="${guideUrl}">${guideUrl}</a>
      </p>
    </div>
  `;

  const messageText = [
    "Game-Changrs analytics access is ready.",
    `Your email is approved for ${accessRole} access to ${seriesName}.`,
    "The attached HTML guide explains how to open the series, search players, and when to use Player Assessment versus Player Intelligence.",
    `Browser copy: ${guideUrl}`,
  ].join("\n");

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
          content: Buffer.from(guideHtml, "utf8").toString("base64"),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.message === "string" && payload.message
        ? payload.message
        : `Series viewer guide email failed with status ${response.status}.`;
    throw createHttpError(detail, response.status, payload);
  }

  return {
    id: payload?.id || null,
    email: targetEmail,
    filename,
    guideUrl,
  };
}

module.exports = {
  getSeriesViewerGuidePublicUrl,
  loadSeriesViewerGuideHtml,
  sendSeriesViewerGuideEmail,
};
