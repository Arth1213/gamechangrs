"use strict";

const { escapeHtml } = require("../lib/utils");

function renderLocalOpsConsolePage({ overview, port }) {
  const initialOverviewJson = JSON.stringify(overview || {}).replace(/</g, "\\u003c");
  const startCommand = `PORT=${port} npm run ops:ui:start`;
  const runbooks = Array.isArray(overview?.runbooks) ? overview.runbooks : [];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Game-Changrs Local Ops Console</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08121f;
        --panel: rgba(9, 19, 34, 0.9);
        --panel-strong: #0f2035;
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
        width: min(1260px, calc(100vw - 32px));
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
        gap: 20px;
      }
      .hero-top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
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
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.05;
      }
      .hero-copy {
        max-width: 760px;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.7;
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
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        word-break: break-word;
      }
      .grid {
        margin-top: 22px;
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 18px;
      }
      .panel {
        padding: 22px;
        min-width: 0;
      }
      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-7 { grid-column: span 7; }
      .span-5 { grid-column: span 5; }
      .span-6 { grid-column: span 6; }
      .span-4 { grid-column: span 4; }
      h2 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .section-copy {
        margin: 0 0 18px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }
      .series-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
        gap: 14px;
      }
      .series-card {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
        display: grid;
        gap: 12px;
      }
      .series-card-top {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
      }
      .series-card h3 {
        margin: 0;
        font-size: 18px;
      }
      .series-card small {
        color: var(--muted);
      }
      .series-note {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }
      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
      }
      .badge.good { color: var(--good); border-color: rgba(105, 225, 182, 0.35); }
      .badge.warn { color: var(--warn); border-color: rgba(245, 183, 107, 0.35); }
      .badge.bad { color: var(--bad); border-color: rgba(255, 138, 138, 0.35); }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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
        font-size: 20px;
        font-weight: 600;
      }
      .workflow-guide-grid,
      .workflow-track-grid,
      .queue-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 14px;
      }
      .workflow-guide,
      .workflow-track,
      .queue-card {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
        display: grid;
        gap: 12px;
      }
      .workflow-guide h3,
      .workflow-track h3,
      .queue-card h3 {
        margin: 0;
        font-size: 17px;
      }
      .workflow-guide p,
      .workflow-track p,
      .queue-card p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }
      .workflow-track-actions {
        display: grid;
        gap: 8px;
      }
      .workflow-action-card {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.45);
        padding: 12px 14px;
        display: grid;
        gap: 8px;
      }
      .workflow-action-copy {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .workflow-list {
        display: grid;
        gap: 10px;
      }
      .workflow-list-item {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.45);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .workflow-list-item strong {
        font-size: 13px;
      }
      .workflow-list-item span,
      .workflow-list-item code {
        color: var(--muted);
        font-size: 12px;
        word-break: break-word;
      }
      .selected-series-shell {
        display: grid;
        gap: 18px;
      }
      .selected-series-top {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 14px;
      }
      .selected-series-top h3 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      .selected-series-top p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .selected-series-meta {
        min-width: 260px;
        display: grid;
        gap: 10px;
      }
      .selected-series-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .selected-series-actions code {
        display: block;
        max-width: 100%;
        word-break: break-word;
      }
      .workflow-track-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .workflow-track-header small {
        color: var(--muted);
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
      .status-pill.complete,
      .status-pill.completed,
      .workflow-step.complete .status-pill {
        color: var(--good);
        border-color: rgba(105, 225, 182, 0.35);
      }
      .status-pill.running {
        color: var(--accent-2);
        border-color: rgba(127, 179, 255, 0.35);
      }
      .status-pill.queued {
        color: var(--accent-2);
        border-color: rgba(127, 179, 255, 0.35);
      }
      .status-pill.interrupted,
      .workflow-step.interrupted .status-pill {
        color: var(--warn);
        border-color: rgba(245, 183, 107, 0.35);
      }
      .status-pill.canceled,
      .status-pill.cancelled {
        color: var(--bad);
        border-color: rgba(255, 138, 138, 0.35);
      }
      .status-pill.in_progress,
      .status-pill.stale,
      .status-pill.standby,
      .workflow-step.stale .status-pill,
      .workflow-step.standby .status-pill {
        color: var(--warn);
        border-color: rgba(245, 183, 107, 0.35);
      }
      .status-pill.failed {
        color: var(--bad);
        border-color: rgba(255, 138, 138, 0.35);
      }
      .status-pill.blocked,
      .workflow-step.blocked .status-pill {
        color: var(--bad);
        border-color: rgba(255, 138, 138, 0.35);
      }
      .workflow-step-grid {
        display: grid;
        gap: 10px;
      }
      .workflow-step {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.48);
        padding: 12px 14px;
        display: grid;
        gap: 8px;
      }
      .workflow-step-header {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }
      .workflow-step-header strong {
        font-size: 13px;
      }
      .workflow-step p {
        margin: 0;
        font-size: 12px;
        line-height: 1.55;
        color: var(--muted);
      }
      .workflow-step code {
        display: block;
        font-size: 12px;
        color: var(--muted);
        word-break: break-word;
      }
      .workflow-step.complete {
        background: rgba(13, 41, 31, 0.32);
      }
      .workflow-step.interrupted,
      .workflow-step.stale,
      .workflow-step.standby {
        background: rgba(63, 42, 17, 0.28);
      }
      .workflow-step.blocked {
        background: rgba(68, 24, 24, 0.3);
      }
      .run-monitor {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
        display: grid;
        gap: 14px;
      }
      .run-monitor-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .run-monitor-header h3 {
        margin: 0;
        font-size: 17px;
      }
      .run-monitor-header p {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }
      .run-monitor-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
      }
      .run-log {
        max-height: 260px;
        min-height: 160px;
      }
      .run-log-empty {
        border: 1px dashed var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        color: var(--muted);
        font-size: 13px;
        background: rgba(7, 16, 28, 0.32);
      }
      .run-history {
        display: grid;
        gap: 10px;
      }
      .run-history-item {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.45);
        padding: 14px 16px;
        display: grid;
        gap: 10px;
      }
      .run-history-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .run-history-header strong {
        display: block;
        font-size: 13px;
      }
      .run-history-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .run-step-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .run-step-actions,
      .queue-item-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .queue-list {
        display: grid;
        gap: 10px;
      }
      .queue-item {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(7, 16, 28, 0.45);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .queue-item strong {
        font-size: 13px;
      }
      .queue-item small,
      .queue-item span {
        color: var(--muted);
        line-height: 1.5;
      }
      .mono {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .button-small {
        padding: 8px 12px;
        font-size: 12px;
      }
      form {
        display: grid;
        gap: 14px;
      }
      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .field-grid.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      label {
        display: grid;
        gap: 7px;
        font-size: 13px;
        color: var(--muted);
      }
      input, textarea, select {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(7, 16, 28, 0.82);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }
      textarea { min-height: 110px; resize: vertical; }
      .checkbox-row {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .checkbox {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
      }
      .checkbox input {
        width: 16px;
        height: 16px;
        padding: 0;
      }
      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
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
      .button-warn {
        background: rgba(245, 183, 107, 0.12);
        color: var(--warn);
        border: 1px solid rgba(245, 183, 107, 0.28);
      }
      .button-bad {
        background: rgba(255, 138, 138, 0.12);
        color: var(--bad);
        border: 1px solid rgba(255, 138, 138, 0.28);
      }
      .status-box {
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.03);
        padding: 14px 16px;
        min-height: 60px;
        color: var(--muted);
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
      .hint {
        font-size: 12px;
        color: var(--muted);
      }
      @media (max-width: 980px) {
        .span-8, .span-7, .span-5, .span-6, .span-4 { grid-column: span 12; }
        .field-grid, .field-grid.three { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div>
            <div class="eyebrow">Game-Changrs Local Ops</div>
            <h1>Local series onboarding, refresh, compute, validate, and publish</h1>
            <p class="hero-copy">
              This surface is local-only. It exists inside <code>bay-area-u15</code> and is meant for source probing,
              series registration, extraction, refresh, compute, validation, and publish gating on this machine.
              The hosted Game-Changrs app remains a read-only consumer of prepared analytics data.
            </p>
          </div>
          <div class="hero-meta">
            <div class="meta-chip">
              <b>Start Command</b>
              <code>${escapeHtml(startCommand)}</code>
            </div>
            <div class="meta-chip">
              <b>Config Path</b>
              <code>${escapeHtml(overview?.configPath || "config/leagues.yaml")}</code>
            </div>
            <div class="meta-chip">
              <b>Boundary</b>
              <code>Loopback only, env-gated, not for hosted access</code>
            </div>
          </div>
        </div>
      </section>

      <div class="grid">
        <section class="panel span-12">
          <h2>Series Overview</h2>
          <p class="section-copy">Current local registry state, current workflow status, and the next safe operator step for each configured series.</p>
          <div id="series-grid" class="series-grid"></div>
        </section>

        <section class="panel span-12">
          <h2>Workflow Tracks</h2>
          <p class="section-copy">These are the locked local-only operator paths. Dry-run and live-publish presets are split explicitly, and recent workflow runs can now be rerun from a chosen step.</p>
          <div class="workflow-guide-grid">
            <article class="workflow-guide">
              <h3>New Series</h3>
              <p>Use this when onboarding a new series from source probe to live publish.</p>
              <div class="workflow-list">
                <div class="workflow-list-item"><strong>1. Probe</strong><span>Probe the source URL and confirm executive/intelligence viability.</span></div>
                <div class="workflow-list-item"><strong>2. Register</strong><span>Register the series locally under the correct entity with the source reference locked.</span></div>
                <div class="workflow-list-item"><strong>3. Stage → Run</strong><span>Stage discovery and inventory, then run initial ingest for match facts.</span></div>
                <div class="workflow-list-item"><strong>4. Compute → Validate → Publish</strong><span>Build season, composite, intelligence, then validate and publish.</span></div>
              </div>
            </article>
            <article class="workflow-guide">
              <h3>Refresh Existing</h3>
              <p>Use this when new matches land or when a specific match needs to be refreshed.</p>
              <div class="workflow-list">
                <div class="workflow-list-item"><strong>1. Refresh</strong><span>Run series refresh or a one-match refresh locally.</span></div>
                <div class="workflow-list-item"><strong>2. Recompute</strong><span>Rebuild season aggregation, composite scoring, and player intelligence.</span></div>
                <div class="workflow-list-item"><strong>3. Validate</strong><span>Check publish readiness again after the refreshed data path.</span></div>
                <div class="workflow-list-item"><strong>4. Publish</strong><span>Apply the refreshed dataset only after the validation gate is clean.</span></div>
              </div>
            </article>
            <article class="workflow-guide">
              <h3>Operator Rules</h3>
              <p>Keep refresh and onboarding local. The hosted frontend remains a read-only consumer of prepared outputs.</p>
              <div class="workflow-list">
                <div class="workflow-list-item"><strong>Hosted boundary</strong><span>No scrape, no raw ingest, no recompute orchestration from the live app.</span></div>
                <div class="workflow-list-item"><strong>Local boundary</strong><span>Probe, register, stage, run, refresh, compute, validate, and publish from this machine.</span></div>
                <div class="workflow-list-item"><strong>Debug rule</strong><span>Use artifact timestamps, queue summaries, and the selected-series workflow below before rerunning steps blindly.</span></div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel span-8">
          <h2>Selected Series Workflow</h2>
          <p class="section-copy">This is the operator view for the series currently selected in the series actions form.</p>
          <div id="selected-series-workflow" class="selected-series-shell"></div>
        </section>

        <section class="panel span-4">
          <h2>Queue Visibility</h2>
          <p class="section-copy">Current local queue state plus the latest worker-side queue summaries written under <code>storage/exports</code>.</p>
          <div id="queue-grid" class="queue-grid"></div>
        </section>

        <section class="panel span-5">
          <h2>New Series Intake</h2>
          <p class="section-copy">Probe a new source URL, then register it into the local control plane without involving the hosted frontend.</p>

          <form id="probe-form">
            <div class="field-grid">
              <label>
                Source system
                <select name="sourceSystem">
                  <option value="cricclubs">cricclubs</option>
                </select>
              </label>
              <label>
                Display label
                <input name="label" placeholder="MilC 2025" />
              </label>
            </div>
            <label>
              Series URL
              <input name="url" placeholder="https://cricclubs.com/... or custom domain URL" />
            </label>
            <div class="action-row">
              <button type="button" class="button-primary" data-action="probe" data-form="probe-form">Probe Source</button>
            </div>
          </form>

          <div style="height: 18px"></div>

          <form id="register-form">
            <div class="field-grid">
              <label>
                Entity
                <input name="entity" placeholder="Grizzlies Cricket" />
              </label>
              <label>
                Display label
                <input name="label" placeholder="MilC 2025" />
              </label>
            </div>
            <div class="field-grid three">
              <label>
                Source system
                <select name="sourceSystem">
                  <option value="cricclubs">cricclubs</option>
                </select>
              </label>
              <label>
                Season year
                <input name="seasonYear" placeholder="2025" />
              </label>
              <label>
                Target age group
                <input name="targetAgeGroup" placeholder="Open" />
              </label>
            </div>
            <label>
              Series URL
              <input name="url" placeholder="https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" />
            </label>
            <label>
              Notes
              <textarea name="notes" placeholder="Optional setup notes for this local registration"></textarea>
            </label>
            <div class="checkbox-row">
              <label class="checkbox"><input type="checkbox" name="dryRun" checked /> Dry run</label>
            </div>
            <div class="action-row">
              <button type="button" class="button-primary" data-action="register" data-form="register-form" data-confirm-live="This will register the series locally and update config/leagues.yaml. Continue?">Register Series</button>
            </div>
          </form>
        </section>

        <section class="panel span-7">
          <h2>Series Operations</h2>
          <p class="section-copy">Run local staging, extraction, compute, refresh, validation, and publish actions against an existing series.</p>

          <form id="series-ops-form">
            <div class="field-grid three">
              <label>
                Series
                <select name="series" id="series-select"></select>
              </label>
              <label>
                Single match id
                <input name="matchId" placeholder="7574" />
              </label>
              <label>
                Match ids
                <input name="matchIds" placeholder="853,852" />
              </label>
            </div>
            <div class="field-grid three">
              <label>
                Match limit
                <input name="matchLimit" placeholder="5" />
              </label>
              <label>
                Player ids
                <input name="playerIds" placeholder="355,352" />
              </label>
              <label>
                Enrichment limit
                <input name="limit" placeholder="25" />
              </label>
            </div>
            <div class="field-grid">
              <label>
                Pause ms
                <input name="pauseMs" placeholder="250" />
              </label>
              <label>
                Internal DB match id
                <input name="dbMatchId" placeholder="93" />
              </label>
            </div>
            <div class="checkbox-row">
              <label class="checkbox"><input type="checkbox" name="headless" /> Headless browser</label>
              <label class="checkbox"><input type="checkbox" name="skipPipeline" /> Skip pipeline</label>
              <label class="checkbox"><input type="checkbox" name="useStagedInventory" /> Use staged inventory</label>
              <label class="checkbox"><input type="checkbox" name="force" /> Force profile enrichment</label>
              <label class="checkbox"><input type="checkbox" name="dryRun" checked /> Dry run publish only</label>
            </div>
            <div class="action-row">
              <button type="button" class="button-secondary" data-action="stage" data-form="series-ops-form">Stage</button>
              <button type="button" class="button-secondary" data-action="run" data-form="series-ops-form">Run Pipeline</button>
              <button type="button" class="button-secondary" data-action="refresh-series" data-form="series-ops-form">Refresh Series</button>
              <button type="button" class="button-secondary" data-action="refresh-match" data-form="series-ops-form">Refresh Match</button>
              <button type="button" class="button-secondary" data-action="compute-season" data-form="series-ops-form">Compute Season</button>
              <button type="button" class="button-secondary" data-action="compute-composite" data-form="series-ops-form">Compute Composite</button>
              <button type="button" class="button-secondary" data-action="enrich-profiles" data-form="series-ops-form">Enrich Profiles</button>
              <button type="button" class="button-secondary" data-action="compute-intelligence" data-form="series-ops-form">Compute Intelligence</button>
              <button type="button" class="button-warn" data-action="validate-series" data-form="series-ops-form">Validate Series</button>
              <button type="button" class="button-bad" data-action="publish-series" data-form="series-ops-form" data-confirm-live="This will publish the selected series locally, update config/leagues.yaml, and activate the DB source config. Continue if dry run is unchecked.">Publish Series</button>
            </div>
          </form>

          <div style="height: 18px"></div>

          <div class="status-box" id="status-box">Ready. Pick an action and the live result will appear below.</div>
          <div style="height: 12px"></div>
          <pre id="result-box">No operation run yet.</pre>
          <p class="hint">The publish action respects the validation gate. If dry run remains checked, the publish transaction is validated but not committed.</p>
        </section>

        <section class="panel span-6">
          <h2>Runbooks</h2>
          <p class="section-copy">The markdown runbooks remain the explicit source of truth. The workflow panels above now mirror that order and the current artifact state.</p>
          <div class="stats">
            ${runbooks.map((runbook) => `<div class="stat"><b>Runbook</b><span>${escapeHtml(runbook)}</span></div>`).join("")}
          </div>
        </section>

        <section class="panel span-6">
          <h2>Notes</h2>
          <p class="section-copy">This surface is intentionally local-only. It does not change the hosted Game-Changrs frontend unless you run a real publish operation for a validated series.</p>
          <div class="stats">
            <div class="stat"><b>Hosted boundary</b><span>Read-only consumer</span></div>
            <div class="stat"><b>Local boundary</b><span>Probe → Register → Stage → Run/Refresh → Compute → Validate → Publish</span></div>
            <div class="stat"><b>Access rule</b><span>Requires LOCAL_OPS_ENABLE_UI and loopback origin</span></div>
          </div>
        </section>
      </div>
    </div>

    <script>
      const initialOverview = ${initialOverviewJson};
      let currentOverview = initialOverview;
      const seriesGrid = document.getElementById("series-grid");
      const seriesSelect = document.getElementById("series-select");
      const selectedSeriesWorkflow = document.getElementById("selected-series-workflow");
      const queueGrid = document.getElementById("queue-grid");
      const statusBox = document.getElementById("status-box");
      const resultBox = document.getElementById("result-box");
      let overviewPollTimer = null;

      function formatTimestamp(value) {
        if (!value) return "Not run yet";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(date);
      }

      function statusLabel(status) {
        switch (status) {
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
          case "pending":
          default:
            return "Pending";
        }
      }

      function toneForRunStatus(status) {
        switch (status) {
          case "completed":
          case "complete":
            return "good";
          case "canceled":
          case "cancelled":
            return "bad";
          case "queued":
          case "running":
            return "";
          case "interrupted":
            return "warn";
          case "failed":
          case "blocked":
            return "bad";
          case "stale":
          case "in_progress":
          case "standby":
            return "warn";
          default:
            return "";
        }
      }

      function badgeToneForSeries(series) {
        const validation = series?.artifacts?.validation?.summary;
        if (!validation) return "warn";
        return validation.publishReady ? "good" : "bad";
      }

      function escapeHtmlText(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function getSelectedSeries(payload) {
        const series = Array.isArray(payload?.series) ? payload.series : [];
        if (!series.length) return null;
        return series.find((entry) => entry.slug === seriesSelect.value) || series[0];
      }

      function renderInlineActionButton(label, action, payload = {}, options = {}) {
        const className = options.className || "button-secondary button-small";
        const formAttr = options.form ? \` data-form="\${escapeHtmlText(options.form)}"\` : "";
        const confirmAttr = options.confirm
          ? \` data-confirm-live="\${escapeHtmlText(options.confirm)}"\`
          : "";
        return \`
          <button
            type="button"
            class="\${escapeHtmlText(className)}"
            data-action="\${escapeHtmlText(action || "")}"
            data-payload-overrides='\${escapeHtmlText(JSON.stringify(payload || {}))}'
            \${formAttr}
            \${confirmAttr}
          >\${escapeHtmlText(label || "Run Action")}</button>
        \`;
      }

      function renderRunInspectorLink(run) {
        if (!run?.runId) {
          return "";
        }

        return \`
          <a
            class="button-link button-secondary button-small"
            href="/local-ops/runs/\${encodeURIComponent(run.runId)}"
          >Open Run</a>
        \`;
      }

      function renderRunControlButtons(run) {
        const buttons = [];

        const inspectorLink = renderRunInspectorLink(run);
        if (inspectorLink) {
          buttons.push(inspectorLink);
        }

        if (run?.status === "queued" && run?.runId) {
          buttons.push(renderInlineActionButton(
            "Cancel Queued Run",
            "cancel-run",
            {
              runId: run.runId,
              series: run.seriesConfigKey || "",
            },
            {
              className: "button-bad button-small",
              confirm: "Remove this queued local run before it starts?",
            }
          ));
        }

        if (run?.workflowResume && run.status !== "queued" && run.status !== "running") {
          buttons.push(renderInlineActionButton(
            run.workflowResume.label || "Resume Remaining",
            run.workflowResume.action || run.actionKey || "",
            run.workflowResume.payload || {},
            {
              className: "button-primary button-small",
              confirm: run.workflowResume.confirmLive
                ? "This workflow rerun can apply a live publish for the selected series. Continue?"
                : "",
            }
          ));
        }

        if (run?.retryInput && run.status !== "queued" && run.status !== "running") {
          buttons.push(renderInlineActionButton(
            "Retry Run",
            run.actionKey || "",
            run.retryInput || {},
            {
              className: "button-secondary button-small",
              confirm: run.actionKey === "publish-series" && run.retryInput?.dryRun !== true
                ? "This will publish the selected series locally. Continue?"
                : "",
            }
          ));
        }

        return buttons.length
          ? \`<div class="run-history-actions">\${buttons.join("")}</div>\`
          : "";
      }

      function renderWorkflowRunSteps(run) {
        const steps = Array.isArray(run?.workflowSteps) ? run.workflowSteps : [];
        if (!steps.length) {
          return "";
        }

        const rerunOptions = Array.isArray(run?.workflowRerunOptions) ? run.workflowRerunOptions : [];
        const rerunByKey = new Map(rerunOptions.map((option) => [option.key, option]));
        const completedCount = steps.filter((step) => step.status === "completed").length;
        const requestedCount = run?.workflowRequestedSteps || steps.length;

        return \`
          <div>
            <div class="workflow-track-header">
              <div>
                <h3>Step Summary</h3>
                <small>\${escapeHtmlText(run.workflowLabel || "Guided workflow")}</small>
              </div>
              <span class="status-pill \${escapeHtmlText(run.status || "pending")}">\${escapeHtmlText(\`\${completedCount}/\${requestedCount} steps\`)}</span>
            </div>
            \${run.workflowStopReason ? \`<p class="series-note">\${escapeHtmlText(run.workflowStopReason)}</p>\` : ""}
            <div class="workflow-step-grid">
              \${steps.map((step) => {
                const rerun = rerunByKey.get(step.key);
                const meta = [];
                if (step.dryRun === true) meta.push("Dry run");
                if (step.dryRun === false) meta.push("Live publish");
                meta.push(\`Updated \${formatTimestamp(step.updatedAt)}\`);
                return \`
                  <div class="workflow-step \${escapeHtmlText(step.status || "pending")}">
                    <div class="workflow-step-header">
                      <div>
                        <strong>\${escapeHtmlText(step.label || step.key || "Step")}</strong>
                      </div>
                      <span class="status-pill \${escapeHtmlText(step.status || "pending")}">\${escapeHtmlText(statusLabel(step.status))}</span>
                    </div>
                    <p>\${escapeHtmlText(step.summary || "No step summary available.")}</p>
                    <div class="run-step-meta">
                      \${meta.map((item) => \`<span>\${escapeHtmlText(item)}</span>\`).join("")}
                    </div>
                    \${step.command ? \`<code class="mono">\${escapeHtmlText(step.command)}</code>\` : ""}
                    \${rerun ? \`
                      <div class="run-step-actions">
                        \${renderInlineActionButton(
                          "Rerun From Here",
                          rerun.action || run.actionKey || "",
                          rerun.payload || {},
                          {
                            className: "button-secondary button-small",
                            confirm: rerun.confirmLive
                              ? "This workflow rerun can apply a live publish for the selected series. Continue?"
                              : "",
                          }
                        )}
                      </div>
                    \` : ""}
                  </div>
                \`;
              }).join("")}
            </div>
          </div>
        \`;
      }

      function renderWorkflowTrack(track) {
        if (!track) return "";
        const presets = Array.isArray(track?.presets)
          ? track.presets.filter((preset) => preset && preset.visible !== false)
          : track?.preset && track.preset.visible !== false
            ? [track.preset]
            : [];
        const presetMarkup = presets.length
          ? \`
            <div class="workflow-track-actions">
              \${presets.map((preset) => \`
                <div class="workflow-action-card">
                  \${renderInlineActionButton(
                    preset.label || "Run Workflow",
                    preset.action || "",
                    preset.payloadOverrides || {},
                    {
                      className: \`\${preset.variant === "warn" ? "button-warn" : preset.variant === "secondary" ? "button-secondary" : "button-primary"} button-small\`,
                      form: preset.form || "series-ops-form",
                      confirm: preset.confirmLive
                        ? "This guided workflow can apply a live publish for the selected series. Continue?"
                        : "",
                    }
                  )}
                  \${preset.summary ? \`<div class="workflow-action-copy">\${escapeHtmlText(preset.summary)}</div>\` : ""}
                </div>
              \`).join("")}
            </div>
          \`
          : "";
        return \`
          <article class="workflow-track">
            <div class="workflow-track-header">
              <div>
                <h3>\${escapeHtmlText(track.label || "Workflow")}</h3>
                <small>\${escapeHtmlText(statusLabel(track.status))}</small>
              </div>
              <span class="status-pill \${escapeHtmlText(track.status || "pending")}">\${escapeHtmlText(statusLabel(track.status))}</span>
            </div>
            \${presetMarkup}
            <div class="workflow-step-grid">
              \${(Array.isArray(track.steps) ? track.steps : []).map((step) => \`
                <div class="workflow-step \${escapeHtmlText(step.status || "pending")}">
                  <div class="workflow-step-header">
                    <div>
                      <strong>\${escapeHtmlText(step.label || step.key || "Step")}</strong>
                      \${step.optional ? '<small class="hint">Optional</small>' : ""}
                    </div>
                    <span class="status-pill \${escapeHtmlText(step.status || "pending")}">\${escapeHtmlText(statusLabel(step.status))}</span>
                  </div>
                  <p>\${escapeHtmlText(step.summary || "No summary available.")}</p>
                  <small class="hint">Updated: \${escapeHtmlText(formatTimestamp(step.updatedAt))}</small>
                  \${step.command ? \`<code class="mono">\${escapeHtmlText(step.command)}</code>\` : ""}
                </div>
              \`).join("")}
            </div>
          </article>
        \`;
      }

      function renderLatestRun(run) {
        if (!run) {
          return \`
            <div class="run-log-empty">
              No local operator run has been recorded for this series yet.
            </div>
          \`;
        }

        const logLines = Array.isArray(run.recentLogLines) ? run.recentLogLines : [];
        const summary = run.summary || run.message || "No run summary available.";
        const note = run.note || "";
        const artifactPath = run.artifactPath || "No artifact path recorded";
        const detailPath = run.detailPath || "No run detail path recorded";
        const statusPath = run.statusPath || "No status file recorded";
        const commandPreview = run.commandPreview || "";
        const workflowMeta = run.workflowKey
          ? \`
            <div class="run-monitor-grid">
              <div class="stat">
                <b>Workflow</b>
                <span>\${escapeHtmlText(run.workflowLabel || run.workflowKey)}</span>
              </div>
              <div class="stat">
                <b>Steps</b>
                <span>\${escapeHtmlText(\`\${(Array.isArray(run.workflowSteps) ? run.workflowSteps.filter((step) => step.status === "completed").length : 0)}/\${run.workflowRequestedSteps || (Array.isArray(run.workflowSteps) ? run.workflowSteps.length : 0)}\`)}</span>
              </div>
              <div class="stat">
                <b>Start Step</b>
                <span>\${escapeHtmlText(run.workflowStartStepLabel || "Full chain")}</span>
              </div>
              <div class="stat">
                <b>Run Mode</b>
                <span>\${escapeHtmlText(run.workflowStoppedEarly ? "Stopped early" : "Full run")}</span>
              </div>
            </div>
          \`
          : "";

        return \`
          <section class="run-monitor">
            <div class="run-monitor-header">
              <div>
                <h3>Latest Operator Run</h3>
                <p>\${escapeHtmlText(summary)}</p>
                \${note ? \`<p class="series-note">\${escapeHtmlText(note)}</p>\` : ""}
              </div>
              <span class="status-pill \${escapeHtmlText(run.status || "pending")}">\${escapeHtmlText(statusLabel(run.status))}</span>
            </div>
            <div class="run-monitor-grid">
              <div class="stat">
                <b>Action</b>
                <span>\${escapeHtmlText(run.actionLabel || run.actionKey || "-")}</span>
              </div>
              <div class="stat">
                <b>Queued</b>
                <span>\${escapeHtmlText(formatTimestamp(run.createdAt || run.startedAt))}</span>
              </div>
              <div class="stat">
                <b>Started</b>
                <span>\${escapeHtmlText(formatTimestamp(run.startedAt))}</span>
              </div>
              <div class="stat">
                <b>Finished</b>
                <span>\${escapeHtmlText(run.finishedAt ? formatTimestamp(run.finishedAt) : "Still running")}</span>
              </div>
              <div class="stat">
                <b>Duration</b>
                <span>\${escapeHtmlText(Number.isFinite(run.durationMs) && run.durationMs >= 0 ? \`\${Math.round(run.durationMs / 1000)}s\` : "-")}</span>
              </div>
            </div>
            \${workflowMeta}
            \${renderRunControlButtons(run)}
            \${run.queuePosition ? \`<div class="meta-chip"><b>Queue Position</b><code>\${escapeHtmlText(run.queuePosition)}</code></div>\` : ""}
            \${run.pid ? \`<div class="meta-chip"><b>Worker PID</b><code>\${escapeHtmlText(run.pid)}</code></div>\` : ""}
            \${commandPreview ? \`<div class="meta-chip"><b>Command</b><code>\${escapeHtmlText(commandPreview)}</code></div>\` : ""}
            <div class="meta-chip">
              <b>Run Detail</b>
              <code>\${escapeHtmlText(detailPath)}</code>
            </div>
            <div class="meta-chip">
              <b>Status File</b>
              <code>\${escapeHtmlText(statusPath)}</code>
            </div>
            <div class="meta-chip">
              <b>Artifact</b>
              <code>\${escapeHtmlText(artifactPath)}</code>
            </div>
            \${renderWorkflowRunSteps(run)}
            \${logLines.length
              ? \`<pre class="run-log">\${escapeHtmlText(logLines.join("\\n"))}</pre>\`
              : '<div class="run-log-empty">No log lines were captured for this run.</div>'}
          </section>
        \`;
      }

      function renderRecentRuns(runs) {
        const items = Array.isArray(runs) ? runs : [];
        if (!items.length) {
          return '<div class="run-log-empty">No run history has been recorded for this series yet.</div>';
        }

        return \`
          <section class="run-monitor">
            <div class="run-monitor-header">
              <div>
                <h3>Recent Runs</h3>
                <p>Retry failed or stale work without rebuilding the series form by hand.</p>
              </div>
            </div>
            <div class="run-history">
              \${items.map((run) => \`
                <div class="run-history-item">
                  <div class="run-history-header">
                    <div>
                      <strong>\${escapeHtmlText(run.actionLabel || run.actionKey || "Run")}</strong>
                      <small class="hint">\${escapeHtmlText(formatTimestamp(run.createdAt || run.startedAt))}</small>
                    </div>
                    <span class="status-pill \${escapeHtmlText(run.status || "pending")}">\${escapeHtmlText(statusLabel(run.status))}</span>
                  </div>
                  <div class="series-note">\${escapeHtmlText(run.summary || run.note || "No run summary available.")}</div>
                  \${run.workflowStopReason ? \`<div class="series-note">\${escapeHtmlText(run.workflowStopReason)}</div>\` : ""}
                  \${run.commandPreview ? \`<code class="mono">\${escapeHtmlText(run.commandPreview)}</code>\` : ""}
                  \${run.detailPath ? \`<code class="mono">\${escapeHtmlText(run.detailPath)}</code>\` : ""}
                  \${renderRunControlButtons(run)}
                  \${renderWorkflowRunSteps(run)}
                </div>
              \`).join("")}
            </div>
          </section>
        \`;
      }

      function renderSelectedSeriesWorkflow(payload) {
        const selectedSeries = getSelectedSeries(payload);
        if (!selectedSeries) {
          selectedSeriesWorkflow.innerHTML = '<div class="status-box">No registered series found in config/leagues.yaml.</div>';
          return;
        }

        const workflow = selectedSeries.workflow || {};
        const nextAction = workflow.nextRecommendedAction || null;
        const validation = selectedSeries?.artifacts?.validation?.summary;
        const publish = selectedSeries?.artifacts?.publish?.summary;
        const latestRun = selectedSeries?.latestRun || null;
        const recentRuns = selectedSeries?.recentRuns || [];

        const nextActionButton = nextAction
          ? \`<button
              type="button"
              class="\${nextAction.standby ? "button-secondary" : "button-primary"}"
              data-action="\${escapeHtmlText(nextAction.action || "")}"
              data-form="series-ops-form"
              data-payload-overrides='\${escapeHtmlText(JSON.stringify(nextAction.payloadOverrides || {}))}'
              \${nextAction.payloadOverrides?.dryRun === false ? 'data-confirm-live="This will run a live publish for the selected series. Continue?"' : ""}
            >\${escapeHtmlText(nextAction.label || "Run Next Step")}</button>\`
          : "";

        selectedSeriesWorkflow.innerHTML = \`
          <div class="selected-series-top">
            <div>
              <h3>\${escapeHtmlText(selectedSeries.label || selectedSeries.slug)}</h3>
              <p>\${escapeHtmlText(workflow.headline || "Workflow summary unavailable.")}</p>
              <p class="series-note">\${escapeHtmlText(workflow.note || "")}</p>
              <div class="badge-row" style="margin-top: 12px;">
                <span class="badge \${selectedSeries.enabled ? "good" : "warn"}">\${selectedSeries.enabled ? "Live in hosted app" : "Local only"}</span>
                <span class="badge \${badgeToneForSeries(selectedSeries)}">\${validation?.publishReady ? "Publish Ready" : "Validation Pending"}</span>
                <span class="badge">\${escapeHtmlText(selectedSeries.sourceSystem || "source")}</span>
                <span class="badge">\${escapeHtmlText(selectedSeries.targetAgeGroup || "Age group not set")}</span>
              </div>
            </div>
            <div class="selected-series-meta">
              <div class="meta-chip">
                <b>Recommended Next Step</b>
                <code>\${escapeHtmlText(nextAction?.command || "No immediate action required.")}</code>
              </div>
              <div class="meta-chip">
                <b>Last Validation</b>
                <code>\${escapeHtmlText(formatTimestamp(selectedSeries?.artifacts?.validation?.updatedAt))}</code>
              </div>
              <div class="meta-chip">
                <b>Last Publish</b>
                <code>\${escapeHtmlText(publish ? formatTimestamp(selectedSeries?.artifacts?.publish?.updatedAt) : "Not published yet")}</code>
              </div>
            </div>
          </div>
          <div class="selected-series-actions">
            \${nextActionButton}
            <button type="button" class="button-secondary" data-action="refreshOverview">Refresh Overview</button>
          </div>
          \${renderLatestRun(latestRun)}
          \${renderRecentRuns(recentRuns)}
          <div class="workflow-track-grid">
            \${renderWorkflowTrack(workflow.onboarding)}
            \${renderWorkflowTrack(workflow.refresh)}
            \${renderWorkflowTrack(workflow.publish)}
          </div>
        \`;
      }

      function renderQueueGrid(payload) {
        const queueCards = [
          {
            label: "Local Action Queue",
            localQueue: payload?.backgroundQueue || null,
          },
          {
            label: "Series Ops Queue",
            queue: payload?.queues?.seriesOperations || null,
          },
          {
            label: "Manual Refresh Queue",
            queue: payload?.queues?.manualRefresh || null,
          },
        ];

        queueGrid.innerHTML = queueCards.map((entry) => {
          if (entry.localQueue) {
            const localQueue = entry.localQueue;
            const items = [...(Array.isArray(localQueue.activeRuns) ? localQueue.activeRuns : []), ...(Array.isArray(localQueue.queuedRuns) ? localQueue.queuedRuns : [])].slice(0, 5);
            return \`
              <article class="queue-card">
                <div class="workflow-track-header">
                  <div>
                    <h3>\${escapeHtmlText(entry.label)}</h3>
                    <small>\${escapeHtmlText(\`\${localQueue.activeCount || 0} active • \${localQueue.queuedCount || 0} queued\`)}</small>
                  </div>
                  <span class="status-pill \${items.length ? "running" : "standby"}">\${escapeHtmlText(\`max \${localQueue.concurrency || 1}\`)}</span>
                </div>
                \${items.length ? \`
                  <div class="queue-list">
                    \${items.map((run) => \`
                      <div class="queue-item">
                        <strong>\${escapeHtmlText(run.seriesConfigKey || run.actionLabel || run.runId || "Run")}</strong>
                        <small>\${escapeHtmlText((run.actionLabel || run.actionKey || "Run") + " • " + statusLabel(run.status))}</small>
                        <span>\${escapeHtmlText(run.summary || run.message || run.note || "No summary available.")}</span>
                        \${run.status === "queued" && run.runId ? \`
                          <div class="queue-item-actions">
                            \${renderInlineActionButton(
                              "Cancel",
                              "cancel-run",
                              {
                                runId: run.runId,
                                series: run.seriesConfigKey || "",
                              },
                              {
                                className: "button-bad button-small",
                                confirm: "Remove this queued local run before it starts?",
                              }
                            )}
                          </div>
                        \` : ""}
                      </div>
                    \`).join("")}
                  </div>
                \` : '<p>No local background runs are queued or active right now.</p>'}
              </article>
            \`;
          }

          const queue = entry.queue;
          const requests = Array.isArray(queue?.summary?.requests) ? queue.summary.requests : [];
          return \`
            <article class="queue-card">
              <div class="workflow-track-header">
                <div>
                  <h3>\${escapeHtmlText(entry.label)}</h3>
                  <small>\${escapeHtmlText(queue ? formatTimestamp(queue.updatedAt) : "No summary yet")}</small>
                </div>
                <span class="status-pill \${queue ? "complete" : "standby"}">\${escapeHtmlText(queue ? \`\${queue.summary.processedCount || 0} processed\` : "No data")}</span>
              </div>
              \${requests.length ? \`
                <div class="queue-list">
                  \${requests.map((request) => \`
                    <div class="queue-item">
                      <strong>\${escapeHtmlText(request.seriesConfigKey || request.operationKey || request.requestId || "Request")}</strong>
                      <small>\${escapeHtmlText(request.requestStatus || "status unknown")}</small>
                      <span>\${escapeHtmlText(request.resultSummary || "No summary available.")}</span>
                    </div>
                  \`).join("")}
                </div>
              \` : '<p>No processed requests have been written into this summary yet.</p>'}
            </article>
          \`;
        }).join("");
      }

      function renderSeriesOverview(payload) {
        const series = Array.isArray(payload?.series) ? payload.series : [];
        seriesGrid.innerHTML = series.map((entry) => {
          const validation = entry?.artifacts?.validation?.summary;
          const publish = entry?.artifacts?.publish?.summary;
          const workflow = entry?.workflow || {};
          const latestRun = entry?.latestRun || null;
          const tone = badgeToneForSeries(entry);
          const validationLabel = validation
            ? validation.publishReady
              ? "Publish Ready"
              : "Blocked"
            : "Not Validated";
          const parsed = validation?.coverage
            ? \`\${validation.coverage.parsedMatchCount || 0} / \${validation.coverage.matchCount || 0}\`
            : "-";
          const nextAction = workflow.nextRecommendedAction;
          return \`
            <article class="series-card">
              <div class="series-card-top">
                <div>
                  <h3>\${escapeHtmlText(entry.label || entry.slug)}</h3>
                  <small>\${escapeHtmlText(entry.slug)}</small>
                </div>
                <button type="button" class="button-secondary button-small" data-use-series="\${escapeHtmlText(entry.slug)}">Use Series</button>
              </div>
              <div class="badge-row">
                <span class="badge \${entry.enabled ? "good" : "warn"}">\${entry.enabled ? "Enabled" : "Disabled"}</span>
                <span class="badge \${tone}">\${validationLabel}</span>
                <span class="badge">\${escapeHtmlText(entry.sourceSystem || "source")}</span>
                \${latestRun ? \`<span class="badge \${toneForRunStatus(latestRun.status)}">\${escapeHtmlText(statusLabel(latestRun.status))}</span>\` : ""}
              </div>
              <div class="stats">
                <div class="stat">
                  <b>Season</b>
                  <span>\${escapeHtmlText(entry.seasonYear || "-")}</span>
                </div>
                <div class="stat">
                  <b>Parsed</b>
                  <span>\${escapeHtmlText(parsed)}</span>
                </div>
                <div class="stat">
                  <b>Last Publish</b>
                  <span>\${escapeHtmlText(publish?.dryRun ? "Dry Run" : publish?.ok ? "Applied" : "-")}</span>
                </div>
              </div>
              <div class="series-note">
                \${escapeHtmlText(workflow.headline || "No workflow summary available.")}
              </div>
              <div class="series-note">
                \${escapeHtmlText(nextAction?.reason || workflow.note || "")}
              </div>
              \${latestRun ? \`<div class="series-note">\${escapeHtmlText(latestRun.summary || latestRun.message || "")}</div>\` : ""}
              \${nextAction ? \`<code class="mono">\${escapeHtmlText(nextAction.command || "")}</code>\` : ""}
            </article>
          \`;
        }).join("");

        const currentValue = seriesSelect.value;
        seriesSelect.innerHTML = series.map((entry) => \`<option value="\${escapeHtmlText(entry.slug)}">\${escapeHtmlText(entry.label || entry.slug)}</option>\`).join("");
        if (series.some((entry) => entry.slug === currentValue)) {
          seriesSelect.value = currentValue;
        } else if (series[0]) {
          seriesSelect.value = series[0].slug;
        }

        renderSelectedSeriesWorkflow(payload);
        renderQueueGrid(payload);
      }

      function serializeForm(form) {
        const payload = {};
        Array.from(form.elements).forEach((element) => {
          if (!element.name || element.disabled) return;
          if (element.type === "checkbox") {
            payload[element.name] = element.checked;
            return;
          }
          const value = String(element.value || "").trim();
          if (value) {
            payload[element.name] = value;
          }
        });
        return payload;
      }

      function syncSeriesSelection(seriesSlug) {
        if (!seriesSlug) return;
        seriesSelect.value = seriesSlug;
        renderSelectedSeriesWorkflow(currentOverview);
      }

      function getLatestRunForSeries(seriesSlug) {
        if (seriesSlug) {
          const series = Array.isArray(currentOverview?.series) ? currentOverview.series : [];
          return series.find((entry) => entry.slug === seriesSlug)?.latestRun || null;
        }

        return currentOverview?.latestRun || null;
      }

      function isRunPending(run) {
        return run?.status === "queued" || run?.status === "running";
      }

      function updateLiveRunOutput(seriesSlug) {
        const run = getLatestRunForSeries(seriesSlug);
        if (!run) {
          return;
        }

        statusBox.textContent = run.lastLogLine || run.message || run.summary || ((run.actionLabel || "Action") + " " + statusLabel(run.status).toLowerCase() + ".");
        if (Array.isArray(run.recentLogLines) && run.recentLogLines.length) {
          resultBox.textContent = run.recentLogLines.join("\\n");
        }
      }

      function stopOverviewPolling() {
        if (overviewPollTimer) {
          window.clearInterval(overviewPollTimer);
          overviewPollTimer = null;
        }
      }

      function startOverviewPolling(seriesSlug) {
        stopOverviewPolling();
        overviewPollTimer = window.setInterval(async () => {
          try {
            await refreshOverview();
            updateLiveRunOutput(seriesSlug);
          } catch (_) {
            // Polling is best-effort while the primary action request is still active.
          }
        }, 1500);
      }

      async function refreshOverview() {
        const response = await fetch("/api/local-ops/overview");
        const payload = await response.json();
        currentOverview = payload;
        renderSeriesOverview(payload);
      }

      async function runActionRequest(action, payload, button) {
        if (action === "refreshOverview") {
          await refreshOverview();
          return;
        }
        const seriesSlug = payload.series || "";
        const dryRun = payload.dryRun === true;
        const confirmation = button.dataset.confirmLive
          || ((action === "publish-series" || action.startsWith("workflow-")) && !dryRun
            ? "This action can apply a live publish for the selected series. Continue?"
            : action === "register" && payload.dryRun !== true
              ? "This will register the series locally and update config/leagues.yaml. Continue?"
              : "");
        if (confirmation) {
          const confirmed = window.confirm(confirmation);
          if (!confirmed) return;
        }

        statusBox.textContent = \`Submitting \${action}...\`;
        resultBox.textContent = "Waiting for live operator logs...";
        startOverviewPolling(seriesSlug);
        const buttons = Array.from(document.querySelectorAll("button[data-action], button[data-retry-action]"));
        buttons.forEach((entry) => { entry.disabled = true; });
        let keepPolling = false;
        try {
          const response = await fetch(\`/api/local-ops/actions/\${action}\`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result?.error || \`\${action} failed with status \${response.status}\`);
          }
          statusBox.textContent = result?.result?.message || result?.message || \`\${action} completed.\`;
          resultBox.textContent = JSON.stringify(result, null, 2);
          await refreshOverview();
          const latestRun = getLatestRunForSeries(seriesSlug);
          keepPolling = isRunPending(latestRun || result?.actionRun);
          if (keepPolling) {
            updateLiveRunOutput(seriesSlug);
          } else {
            stopOverviewPolling();
          }
        } catch (error) {
          try {
            await refreshOverview();
          } catch (_) {
            // Keep the immediate failure response even if overview refresh fails.
          }
          const latestRun = getLatestRunForSeries(seriesSlug);
          keepPolling = isRunPending(latestRun);
          statusBox.textContent = latestRun?.message || error.message || \`\${action} failed.\`;
          resultBox.textContent = latestRun?.recentLogLines?.length
            ? latestRun.recentLogLines.join("\\n")
            : JSON.stringify({ error: error.message || "Unexpected action failure." }, null, 2);
        } finally {
          if (!keepPolling) {
            stopOverviewPolling();
          }
          buttons.forEach((entry) => { entry.disabled = false; });
        }
      }

      async function runAction(action, formId, button) {
        const form = document.getElementById(formId);
        const payload = form ? serializeForm(form) : {};
        const payloadOverrides = button?.dataset?.payloadOverrides
          ? JSON.parse(button.dataset.payloadOverrides)
          : {};
        Object.assign(payload, payloadOverrides);
        if (!payload.series && formId === "series-ops-form") {
          payload.series = seriesSelect.value;
        }
        await runActionRequest(action, payload, button);
      }

      document.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-use-series], button[data-action], button[data-retry-action]");
        if (!button) return;

        if (button.dataset.useSeries) {
          syncSeriesSelection(button.dataset.useSeries);
          return;
        }

        if (button.dataset.retryAction) {
          const payload = button.dataset.retryPayload ? JSON.parse(button.dataset.retryPayload) : {};
          if (!payload.series) {
            payload.series = seriesSelect.value;
          }
          runActionRequest(button.dataset.retryAction, payload, button);
          return;
        }

        if (!button.dataset.action) return;
        runAction(button.dataset.action, button.dataset.form, button);
      });

      seriesSelect.addEventListener("change", () => {
        renderSelectedSeriesWorkflow(currentOverview);
      });

      renderSeriesOverview(initialOverview);
    </script>
  </body>
</html>`;
}

module.exports = {
  renderLocalOpsConsolePage,
};
