"use strict";

const { escapeHtml } = require("../lib/utils");

function formatTimestamp(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "Not recorded";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function statusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "complete":
    case "completed":
      return "Complete";
    case "canceled":
    case "cancelled":
      return "Canceled";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "interrupted":
      return "Interrupted";
    case "in_progress":
      return "In Progress";
    case "failed":
      return "Failed";
    case "blocked":
      return "Blocked";
    case "stale":
      return "Needs Rerun";
    case "standby":
      return "Standby";
    default:
      return "Pending";
  }
}

function toneForStatus(status) {
  switch (String(status || "").toLowerCase()) {
    case "complete":
    case "completed":
      return "good";
    case "canceled":
    case "cancelled":
    case "failed":
    case "blocked":
      return "bad";
    case "interrupted":
    case "stale":
    case "standby":
    case "in_progress":
      return "warn";
    default:
      return "";
  }
}

function renderButtonLink(label, href, className = "button-secondary") {
  return `<a class="button-link ${escapeHtml(className)}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderActionButton(label, action, payload = {}, options = {}) {
  const className = options.className || "button-secondary";
  const confirmAttr = options.confirm
    ? ` data-confirm-live="${escapeHtml(options.confirm)}"`
    : "";

  return `<button
    type="button"
    class="${escapeHtml(className)}"
    data-action="${escapeHtml(action || "")}"
    data-payload='${escapeHtml(JSON.stringify(payload || {}))}'
    ${confirmAttr}
  >${escapeHtml(label)}</button>`;
}

function renderJsonBlock(value, emptyLabel) {
  if (!value) {
    return `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
  }

  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderRunActions(run, runId) {
  const buttons = [
    renderButtonLink("Back To Console", "/local-ops", "button-secondary"),
    renderButtonLink("Overview JSON", `/api/local-ops/runs/${encodeURIComponent(runId)}`, "button-secondary"),
    renderButtonLink("Status JSON", `/api/local-ops/runs/${encodeURIComponent(runId)}/status`, "button-secondary"),
  ];

  if (run?.logPath) {
    buttons.push(renderButtonLink("Open Log", `/api/local-ops/runs/${encodeURIComponent(runId)}/log`, "button-secondary"));
  }

  if (run?.artifactPath) {
    buttons.push(renderButtonLink("Artifact JSON", `/api/local-ops/runs/${encodeURIComponent(runId)}/artifact`, "button-secondary"));
  }

  if (run?.workflowResume && run.status !== "queued" && run.status !== "running") {
    buttons.push(renderActionButton(
      run.workflowResume.label || "Resume Remaining",
      run.workflowResume.action || run.actionKey || "",
      run.workflowResume.payload || {},
      {
        className: "button-primary",
        confirm: run.workflowResume.confirmLive
          ? "This workflow rerun can apply a live publish for the selected series. Continue?"
          : "",
      }
    ));
  }

  if (run?.retryInput && run.status !== "queued" && run.status !== "running") {
    buttons.push(renderActionButton(
      "Retry Run",
      run.actionKey || "",
      run.retryInput || {},
      {
        className: "button-secondary",
        confirm: run.actionKey === "publish-series" && run.retryInput?.dryRun !== true
          ? "This will publish the selected series locally. Continue?"
          : "",
      }
    ));
  }

  if (run?.status === "queued" && run?.runId) {
    buttons.push(renderActionButton(
      "Cancel Queued Run",
      "cancel-run",
      {
        runId: run.runId,
        series: run.seriesConfigKey || "",
      },
      {
        className: "button-bad",
        confirm: "Remove this queued local run before it starts?",
      }
    ));
  }

  return buttons.join("");
}

function renderStepCards(stepLogs = []) {
  if (!stepLogs.length) {
    return "";
  }

  return `
    <section class="panel span-12">
      <div class="panel-header">
        <div>
          <h2>Workflow Steps</h2>
          <p class="section-copy">Each step shows the saved summary, command, and a step-scoped log tail.</p>
        </div>
      </div>
      <div class="step-grid">
        ${stepLogs.map((step) => `
          <article class="step-card ${escapeHtml(toneForStatus(step.status))}">
            <div class="step-top">
              <div>
                <h3>${escapeHtml(step.label || step.key || "Step")}</h3>
                <div class="step-meta">
                  <span class="status-pill ${escapeHtml(toneForStatus(step.status))}">${escapeHtml(statusLabel(step.status))}</span>
                  ${step.updatedAt ? `<span>${escapeHtml(formatTimestamp(step.updatedAt))}</span>` : ""}
                  ${typeof step.dryRun === "boolean" ? `<span>${escapeHtml(step.dryRun ? "Dry run" : "Live publish")}</span>` : ""}
                </div>
              </div>
            </div>
            <p class="step-summary">${escapeHtml(step.summary || "No summary recorded.")}</p>
            ${step.command ? `<code>${escapeHtml(step.command)}</code>` : ""}
            ${Array.isArray(step.logLines) && step.logLines.length
              ? `<pre>${escapeHtml(step.logLines.join("\n"))}</pre>`
              : '<div class="empty">No step-specific log lines were captured.</div>'}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPreviousRunComparison(comparison = null) {
  if (!comparison?.available) {
    return `
      <section class="panel span-8">
        <div class="panel-header">
          <div>
            <h2>Previous Run Comparison</h2>
            <p class="section-copy">${escapeHtml(comparison?.summary || "A previous run is not available for comparison yet.")}</p>
          </div>
        </div>
      </section>
    `;
  }

  const changes = Array.isArray(comparison?.changes) ? comparison.changes : [];
  const latestRun = comparison?.latestRun || {};
  const previousRun = comparison?.previousRun || {};

  return `
    <section class="panel span-8">
      <div class="panel-header">
        <div>
          <h2>Previous Run Comparison</h2>
          <p class="section-copy">${escapeHtml(comparison.summary || "Comparison unavailable.")}</p>
          ${comparison.note ? `<p class="section-copy">${escapeHtml(comparison.note)}</p>` : ""}
        </div>
        <span class="status-pill ${escapeHtml(comparison.limited ? "warn" : "good")}">${escapeHtml(comparison.limited ? "Limited history" : "Snapshot compare")}</span>
      </div>
      <div class="stats">
        <div class="stat"><b>Current Run</b><span>${escapeHtml(latestRun.actionLabel || latestRun.runId || "-")}</span></div>
        <div class="stat"><b>Current Status</b><span>${escapeHtml(statusLabel(latestRun.status))}</span></div>
        <div class="stat"><b>Previous Run</b><span>${escapeHtml(previousRun.actionLabel || previousRun.runId || "-")}</span></div>
        <div class="stat"><b>Previous Status</b><span>${escapeHtml(statusLabel(previousRun.status))}</span></div>
      </div>
      ${changes.length
        ? `
          <div class="compare-grid">
            ${changes.map((change) => `
              <article class="compare-card ${escapeHtml(change.tone || "")}">
                <b>${escapeHtml(change.label || "Change")}</b>
                <div class="compare-flow">
                  <span>Before</span>
                  <strong>${escapeHtml(change.before || "Not recorded")}</strong>
                </div>
                <div class="compare-flow">
                  <span>After</span>
                  <strong>${escapeHtml(change.after || "Not recorded")}</strong>
                </div>
              </article>
            `).join("")}
          </div>
        `
        : '<div class="empty">No readiness movement was recorded between these two runs.</div>'}
    </section>
  `;
}

function renderRunTriagePanel(triage = null) {
  const items = Array.isArray(triage?.items) ? triage.items : [];
  return `
    <section class="panel span-4">
      <div class="panel-header">
        <div>
          <h2>Series Triage</h2>
          <p class="section-copy">${escapeHtml(triage?.summary || "No triage summary available.")}</p>
        </div>
      </div>
      ${triage?.note ? `<div class="empty" style="margin-bottom: 12px;">${escapeHtml(triage.note)}</div>` : ""}
      ${items.length
        ? `
          <div class="triage-grid">
            ${items.map((run) => `
              <article class="triage-card ${escapeHtml(toneForStatus(run.status))}">
                <div class="step-top">
                  <div>
                    <h3>${escapeHtml(run.actionLabel || run.actionKey || "Run")}</h3>
                    <div class="step-meta">
                      <span class="status-pill ${escapeHtml(toneForStatus(run.status))}">${escapeHtml(statusLabel(run.status))}</span>
                      <span>${escapeHtml(formatTimestamp(run.createdAt || run.startedAt))}</span>
                    </div>
                  </div>
                </div>
                <p class="step-summary">${escapeHtml(run.triageReason || run.summary || run.note || "No triage summary available.")}</p>
                <div class="action-grid">
                  ${run.runId ? renderButtonLink("Open Run", `/local-ops/runs/${encodeURIComponent(run.runId)}`, "button-secondary") : ""}
                </div>
              </article>
            `).join("")}
          </div>
        `
        : '<div class="empty">No interrupted, failed, stale, or canceled runs are waiting for follow-up.</div>'}
    </section>
  `;
}

function renderLocalOpsRunPage({ detail, port }) {
  const run = detail?.run || {};
  const runId = run.runId || "unknown-run";
  const seriesLabel = detail?.series?.label || run.seriesConfigKey || "Global run";
  const workflowSteps = Array.isArray(detail?.workflowStepLogs) ? detail.workflowStepLogs : [];
  const logLines = Array.isArray(detail?.logLines) ? detail.logLines : [];
  const comparison = detail?.previousRunComparison || null;
  const triage = detail?.runTriage || null;
  const title = `${run.actionLabel || run.actionKey || "Local Ops Run"} · ${runId}`;
  const startCommand = `PORT=${port} npm run ops:ui:start`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07101b;
        --panel: rgba(9, 19, 34, 0.92);
        --line: rgba(151, 174, 202, 0.18);
        --text: #e7eef8;
        --muted: #9cb1cb;
        --accent: #54d2b1;
        --accent-2: #7fb3ff;
        --warn: #f5b76b;
        --bad: #ff8a8a;
        --good: #69e1b6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(84, 210, 177, 0.12), transparent 28%),
          radial-gradient(circle at top left, rgba(127, 179, 255, 0.14), transparent 32%),
          linear-gradient(180deg, #07101c 0%, #0b1625 100%);
        color: var(--text);
      }
      .shell {
        width: min(1280px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 28px 0 48px;
      }
      .hero,
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        backdrop-filter: blur(18px);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
      }
      .hero {
        padding: 28px;
        display: grid;
        gap: 18px;
      }
      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
        margin-bottom: 10px;
      }
      h1 {
        margin: 0;
        font-size: clamp(26px, 4vw, 40px);
        line-height: 1.08;
      }
      .hero-copy {
        color: var(--muted);
        font-size: 15px;
        line-height: 1.65;
        max-width: 820px;
      }
      .hero-meta {
        display: grid;
        gap: 12px;
        min-width: 280px;
      }
      .meta-chip {
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.03);
        border-radius: 18px;
        padding: 14px 16px;
      }
      .meta-chip b {
        display: block;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .meta-chip code {
        color: var(--text);
        word-break: break-word;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .status-pill.good { color: var(--good); border-color: rgba(105, 225, 182, 0.35); }
      .status-pill.warn { color: var(--warn); border-color: rgba(245, 183, 107, 0.35); }
      .status-pill.bad { color: var(--bad); border-color: rgba(255, 138, 138, 0.35); }
      .grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 18px;
        margin-top: 22px;
      }
      .panel {
        padding: 22px;
        min-width: 0;
      }
      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-6 { grid-column: span 6; }
      .span-4 { grid-column: span 4; }
      .panel-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      h3 {
        margin: 0;
        font-size: 17px;
      }
      .section-copy {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
      }
      .stat {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.55);
        padding: 12px 14px;
      }
      .stat b {
        display: block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .stat span {
        font-size: 18px;
        font-weight: 600;
      }
      .path-grid,
      .action-grid {
        display: grid;
        gap: 12px;
      }
      .path-card {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        padding: 14px 16px;
      }
      .path-card b {
        display: block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .path-card code {
        color: var(--text);
        word-break: break-word;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .action-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      button,
      .button-link {
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        font: inherit;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      button:hover,
      .button-link:hover { transform: translateY(-1px); }
      button:disabled { opacity: 0.55; cursor: wait; transform: none; }
      .button-primary {
        background: linear-gradient(135deg, var(--accent), #3fa9ff);
        color: #04121d;
        font-weight: 700;
      }
      .button-secondary {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        border: 1px solid var(--line);
      }
      .button-bad {
        background: rgba(255, 138, 138, 0.12);
        color: var(--bad);
        border: 1px solid rgba(255, 138, 138, 0.28);
      }
      .status-box,
      .empty {
        border: 1px dashed var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        color: var(--muted);
        font-size: 13px;
        background: rgba(7, 16, 28, 0.32);
      }
      .step-grid {
        display: grid;
        gap: 14px;
      }
      .compare-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 14px;
      }
      .compare-card,
      .triage-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
        display: grid;
        gap: 10px;
      }
      .compare-card.good,
      .triage-card.good { background: rgba(13, 41, 31, 0.32); }
      .compare-card.warn,
      .triage-card.warn { background: rgba(63, 42, 17, 0.28); }
      .compare-card.bad,
      .triage-card.bad { background: rgba(68, 24, 24, 0.3); }
      .compare-card b {
        display: block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .compare-flow {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .compare-flow strong {
        color: var(--text);
        font-size: 14px;
      }
      .triage-grid {
        display: grid;
        gap: 12px;
      }
      .step-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
        display: grid;
        gap: 10px;
      }
      .step-card.good { background: rgba(13, 41, 31, 0.32); }
      .step-card.warn { background: rgba(63, 42, 17, 0.28); }
      .step-card.bad { background: rgba(68, 24, 24, 0.3); }
      .step-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }
      .step-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
        margin-top: 6px;
      }
      .step-summary {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }
      code,
      pre {
        display: block;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      code {
        color: var(--muted);
        word-break: break-word;
        font-size: 12px;
      }
      pre {
        margin: 0;
        border-radius: 18px;
        padding: 18px;
        overflow: auto;
        background: #05101c;
        border: 1px solid var(--line);
        color: #cfe0f4;
        font-size: 12px;
        line-height: 1.55;
      }
      .json-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      @media (max-width: 980px) {
        .span-8, .span-6, .span-4 { grid-column: span 12; }
        .json-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="eyebrow">Local Ops Run Inspector</div>
            <h1>${escapeHtml(run.actionLabel || run.actionKey || "Local Ops Run")}</h1>
            <p class="hero-copy">
              ${escapeHtml(run.summary || run.message || "Saved run detail for local operator debugging.")}<br />
              Run id: <code>${escapeHtml(runId)}</code> · Series: <code>${escapeHtml(seriesLabel)}</code>
            </p>
          </div>
          <div class="hero-meta">
            <div class="meta-chip">
              <b>Status</b>
              <span class="status-pill ${escapeHtml(toneForStatus(run.status))}">${escapeHtml(statusLabel(run.status))}</span>
            </div>
            <div class="meta-chip">
              <b>Start Command</b>
              <code>${escapeHtml(startCommand)}</code>
            </div>
            <div class="meta-chip">
              <b>Boundary</b>
              <code>Loopback-only local ops detail view</code>
            </div>
          </div>
        </div>
      </section>

      <div class="grid">
        <section class="panel span-8">
          <div class="panel-header">
            <div>
              <h2>Run Summary</h2>
              <p class="section-copy">${escapeHtml(run.note || "This view collects the saved status, workflow state, and debug paths for one local run.")}</p>
            </div>
          </div>
          <div class="stats">
            <div class="stat"><b>Action</b><span>${escapeHtml(run.actionLabel || run.actionKey || "-")}</span></div>
            <div class="stat"><b>Series</b><span>${escapeHtml(seriesLabel)}</span></div>
            <div class="stat"><b>Queued</b><span>${escapeHtml(formatTimestamp(run.createdAt || run.startedAt))}</span></div>
            <div class="stat"><b>Started</b><span>${escapeHtml(formatTimestamp(run.startedAt))}</span></div>
            <div class="stat"><b>Finished</b><span>${escapeHtml(formatTimestamp(run.finishedAt))}</span></div>
            <div class="stat"><b>Duration</b><span>${escapeHtml(formatDuration(run.durationMs))}</span></div>
            ${run.workflowLabel ? `<div class="stat"><b>Workflow</b><span>${escapeHtml(run.workflowLabel)}</span></div>` : ""}
            ${run.workflowStartStepLabel ? `<div class="stat"><b>Start Step</b><span>${escapeHtml(run.workflowStartStepLabel)}</span></div>` : ""}
            ${run.commandPreview ? `<div class="stat"><b>Command</b><span>${escapeHtml(run.commandPreview)}</span></div>` : ""}
            ${run.queuePosition ? `<div class="stat"><b>Queue Position</b><span>${escapeHtml(String(run.queuePosition))}</span></div>` : ""}
          </div>
        </section>

        <section class="panel span-4">
          <div class="panel-header">
            <div>
              <h2>Actions</h2>
              <p class="section-copy">Resume, retry, or open raw saved files for this run.</p>
            </div>
          </div>
          <div class="action-grid">
            ${renderRunActions(run, runId)}
          </div>
          <div id="status-box" class="status-box" style="margin-top: 14px;">Run actions post back to the local API and then redirect to the saved run id.</div>
        </section>

        ${renderPreviousRunComparison(comparison)}

        ${renderRunTriagePanel(triage)}

        <section class="panel span-12">
          <div class="panel-header">
            <div>
              <h2>Saved Paths</h2>
              <p class="section-copy">These are the persisted files and directories behind this run.</p>
            </div>
          </div>
          <div class="path-grid">
            <div class="path-card"><b>Run Detail</b><code>${escapeHtml(detail?.files?.detailPath || "Not recorded")}</code></div>
            <div class="path-card"><b>Status File</b><code>${escapeHtml(detail?.files?.statusPath || "Not recorded")}</code></div>
            <div class="path-card"><b>Log File</b><code>${escapeHtml(detail?.files?.logPath || "Not recorded")}</code></div>
            <div class="path-card"><b>Artifact File</b><code>${escapeHtml(detail?.files?.artifactPath || "Not recorded")}</code></div>
          </div>
        </section>

        ${renderStepCards(workflowSteps)}

        <section class="panel span-12">
          <div class="panel-header">
            <div>
              <h2>Run Log Tail</h2>
              <p class="section-copy">Last ${escapeHtml(String(logLines.length || 0))} saved log lines for this run.</p>
            </div>
          </div>
          ${logLines.length ? `<pre>${escapeHtml(logLines.join("\n"))}</pre>` : '<div class="empty">No log lines were captured for this run.</div>'}
        </section>

        <section class="panel span-12">
          <div class="panel-header">
            <div>
              <h2>Saved JSON</h2>
              <p class="section-copy">Status and artifact payloads are rendered here so operators can inspect one run without opening files manually.</p>
            </div>
          </div>
          <div class="json-grid">
            <div>
              <h3>Status JSON</h3>
              ${renderJsonBlock(detail?.rawStatus, "No status payload was recorded.")}
            </div>
            <div>
              <h3>Artifact JSON</h3>
              ${renderJsonBlock(detail?.artifact, "No artifact payload is attached to this run.")}
            </div>
          </div>
        </section>
      </div>
    </div>

    <script>
      const statusBox = document.getElementById("status-box");

      async function runAction(action, payload, button) {
        if (!action) return;
        const confirmMessage = button?.dataset?.confirmLive;
        if (confirmMessage && !window.confirm(confirmMessage)) {
          return;
        }

        if (button) {
          button.disabled = true;
        }

        try {
          statusBox.textContent = "Submitting local action...";
          const response = await fetch("/api/local-ops/actions/" + action, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(payload || {}),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.error || result.message || ("Request failed with status " + response.status));
          }

          statusBox.textContent = result.message || "Local action submitted.";
          const nextRunId = result.runId || result.actionRun?.runId || "";
          if (nextRunId) {
            window.location.assign("/local-ops/runs/" + encodeURIComponent(nextRunId));
            return;
          }
          window.location.reload();
        } catch (error) {
          statusBox.textContent = error && error.message ? error.message : "Local action failed.";
        } finally {
          if (button) {
            button.disabled = false;
          }
        }
      }

      document.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const payload = button.dataset.payload ? JSON.parse(button.dataset.payload) : {};
        runAction(button.dataset.action, payload, button);
      });
    </script>
  </body>
</html>`;
}

module.exports = {
  renderLocalOpsRunPage,
};
