"use strict";

const { escapeHtml } = require("../lib/utils");

function renderLocalOpsConsolePage({ overview, port }) {
  const initialOverviewJson = JSON.stringify(overview || {}).replace(/</g, "\\u003c");
  const startCommand = `PORT=${port} npm run ops:ui:start`;

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
      }
      .span-12 { grid-column: span 12; }
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
      .series-card h3 {
        margin: 0;
        font-size: 18px;
      }
      .series-card small {
        color: var(--muted);
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
      button {
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        font: inherit;
        cursor: pointer;
        transition: transform 120ms ease, opacity 120ms ease;
      }
      button:hover { transform: translateY(-1px); }
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
        .span-7, .span-5, .span-6, .span-4 { grid-column: span 12; }
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
          <p class="section-copy">Current local registry state and the latest validation/publish artifacts for each configured series.</p>
          <div id="series-grid" class="series-grid"></div>
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
          <p class="section-copy">These markdown runbooks remain the source of truth for the local operator flow.</p>
          <div class="stats">
            <div class="stat"><b>Runbook</b><span>ops_runbook_new_series.md</span></div>
            <div class="stat"><b>Runbook</b><span>ops_runbook_manual_refresh.md</span></div>
            <div class="stat"><b>Runbook</b><span>ops_runbook_compute_publish.md</span></div>
          </div>
        </section>

        <section class="panel span-6">
          <h2>Notes</h2>
          <p class="section-copy">This surface is intentionally local-only. It does not change the hosted Game-Changrs frontend unless you run a real publish operation for a validated series.</p>
          <div class="stats">
            <div class="stat"><b>Hosted boundary</b><span>Read-only consumer</span></div>
            <div class="stat"><b>Local boundary</b><span>Probe → Register → Stage → Refresh → Compute → Validate → Publish</span></div>
            <div class="stat"><b>Access rule</b><span>Requires LOCAL_OPS_ENABLE_UI and loopback origin</span></div>
          </div>
        </section>
      </div>
    </div>

    <script>
      const initialOverview = ${initialOverviewJson};

      const seriesGrid = document.getElementById("series-grid");
      const seriesSelect = document.getElementById("series-select");
      const statusBox = document.getElementById("status-box");
      const resultBox = document.getElementById("result-box");

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

      function renderSeriesOverview(payload) {
        const series = Array.isArray(payload?.series) ? payload.series : [];
        seriesGrid.innerHTML = series.map((entry) => {
          const validation = entry?.artifacts?.validation?.summary;
          const publish = entry?.artifacts?.publish?.summary;
          const tone = badgeToneForSeries(entry);
          const validationLabel = validation
            ? validation.publishReady
              ? "Publish Ready"
              : "Blocked"
            : "Not Validated";
          const parsed = validation?.coverage
            ? \`\${validation.coverage.parsedMatchCount || 0} / \${validation.coverage.matchCount || 0}\`
            : "-";
          return \`
            <article class="series-card">
              <div>
                <h3>\${escapeHtmlText(entry.label || entry.slug)}</h3>
                <small>\${escapeHtmlText(entry.slug)}</small>
              </div>
              <div class="badge-row">
                <span class="badge \${entry.enabled ? "good" : "warn"}">\${entry.enabled ? "Enabled" : "Disabled"}</span>
                <span class="badge \${tone}">\${validationLabel}</span>
                <span class="badge">\${escapeHtmlText(entry.sourceSystem || "source")}</span>
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
            </article>
          \`;
        }).join("");

        const currentValue = seriesSelect.value;
        seriesSelect.innerHTML = series.map((entry) => \`<option value="\${escapeHtmlText(entry.slug)}">\${escapeHtmlText(entry.label || entry.slug)}</option>\`).join("");
        if (series.some((entry) => entry.slug === currentValue)) {
          seriesSelect.value = currentValue;
        }
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

      async function refreshOverview() {
        const response = await fetch("/api/local-ops/overview");
        const payload = await response.json();
        renderSeriesOverview(payload);
      }

      async function runAction(action, formId, button) {
        const form = document.getElementById(formId);
        const payload = serializeForm(form);
        const dryRun = payload.dryRun === true;
        const confirmation = button.dataset.confirmLive;
        if (confirmation && action === "publish-series" && !dryRun) {
          const confirmed = window.confirm(confirmation);
          if (!confirmed) return;
        }
        if (confirmation && action === "register" && payload.dryRun !== true) {
          const confirmed = window.confirm(confirmation);
          if (!confirmed) return;
        }

        statusBox.textContent = \`Running \${action}...\`;
        resultBox.textContent = "Working...";
        const buttons = Array.from(document.querySelectorAll("button[data-action]"));
        buttons.forEach((entry) => { entry.disabled = true; });
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
        } catch (error) {
          statusBox.textContent = error.message || \`\${action} failed.\`;
          resultBox.textContent = JSON.stringify({ error: error.message || "Unexpected action failure." }, null, 2);
        } finally {
          buttons.forEach((entry) => { entry.disabled = false; });
        }
      }

      document.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
          runAction(button.dataset.action, button.dataset.form, button);
        });
      });

      renderSeriesOverview(initialOverview);
    </script>
  </body>
</html>`;
}

module.exports = {
  renderLocalOpsConsolePage,
};
