"use strict";

const {
  escapeHtml,
  formatDate,
  humanizeRole,
  normalizeLabel,
  normalizeText,
  toInteger,
  toNumber,
  toneForScore,
} = require("../lib/utils");

const BASE_CSS = `
  :root {
    --bg: #06131c;
    --bg-2: #0b1f2c;
    --panel: rgba(12, 31, 44, 0.9);
    --panel-2: rgba(16, 42, 59, 0.94);
    --panel-3: rgba(18, 48, 66, 0.74);
    --ink: #eef6fb;
    --muted: #9db6c6;
    --line: rgba(145, 192, 215, 0.18);
    --teal: #31c7bf;
    --sky: #67b7ff;
    --lime: #8ed97c;
    --amber: #f0bf69;
    --orange: #f38b63;
    --teal-soft: rgba(49, 199, 191, 0.12);
    --sky-soft: rgba(103, 183, 255, 0.12);
    --lime-soft: rgba(142, 217, 124, 0.14);
    --amber-soft: rgba(240, 191, 105, 0.14);
    --orange-soft: rgba(243, 139, 99, 0.14);
    --shadow: 0 18px 44px rgba(0, 0, 0, 0.26);
    --radius-xl: 30px;
    --radius-lg: 24px;
    --radius-md: 18px;
    --radius-sm: 14px;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    color: var(--ink);
    background:
      radial-gradient(circle at top left, rgba(49, 199, 191, 0.18), transparent 22%),
      radial-gradient(circle at top right, rgba(103, 183, 255, 0.16), transparent 22%),
      linear-gradient(180deg, #081722 0%, #06131c 100%);
    font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
  }

  a {
    color: var(--sky);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  h1, h2, h3, h4 {
    margin: 0;
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    line-height: 0.98;
    letter-spacing: 0.01em;
  }

  h1 {
    font-size: clamp(42px, 5vw, 74px);
  }

  h2 {
    font-size: clamp(30px, 3.1vw, 42px);
  }

  h3 {
    font-size: clamp(22px, 2.3vw, 28px);
  }

  p {
    margin: 0;
  }

  .page-shell {
    width: min(1400px, calc(100% - 28px));
    margin: 18px auto 26px;
  }

  .chrome {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    margin-bottom: 18px;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(145, 192, 215, 0.14);
    background:
      linear-gradient(155deg, rgba(10, 28, 39, 0.96), rgba(7, 20, 29, 0.98)),
      linear-gradient(90deg, rgba(49, 199, 191, 0.08), transparent 30%);
    box-shadow: var(--shadow);
    position: relative;
    overflow: hidden;
  }

  .chrome::before,
  .chrome::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .chrome::before {
    width: 280px;
    height: 280px;
    top: -150px;
    right: -90px;
    background: radial-gradient(circle, rgba(49, 199, 191, 0.20), transparent 68%);
  }

  .chrome::after {
    width: 230px;
    height: 230px;
    bottom: -140px;
    left: -70px;
    background: radial-gradient(circle, rgba(103, 183, 255, 0.16), transparent 68%);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .brand-mark {
    min-width: 44px;
    height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--teal), var(--sky));
    display: grid;
    place-items: center;
    color: #06202c;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.04em;
    box-shadow: 0 10px 24px rgba(49, 199, 191, 0.24);
  }

  .brand-copy {
    display: grid;
    gap: 2px;
  }

  .brand-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--teal);
    font-weight: 800;
  }

  .brand-subtitle {
    font-size: 15px;
    color: #dbeaf1;
    font-weight: 700;
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    position: relative;
    z-index: 1;
  }

  .nav-link {
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(145, 192, 215, 0.12);
    background: rgba(255, 255, 255, 0.035);
    color: var(--muted);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .nav-link:hover {
    text-decoration: none;
    color: var(--ink);
    border-color: rgba(145, 192, 215, 0.24);
  }

  .nav-link.active {
    color: #06202c;
    background: linear-gradient(135deg, var(--teal), #84d9ff);
    border-color: transparent;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    position: relative;
    z-index: 1;
  }

  .pill {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(145, 192, 215, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .pill strong {
    color: var(--muted);
    font-weight: 700;
  }

  .pill-good {
    background: var(--lime-soft);
    color: var(--lime);
  }

  .pill-watch {
    background: var(--amber-soft);
    color: var(--amber);
  }

  .pill-risk {
    background: var(--orange-soft);
    color: var(--orange);
  }

  .sheet {
    margin-bottom: 18px;
    padding: 18px;
    border-radius: 34px;
    background:
      linear-gradient(160deg, rgba(10, 28, 39, 0.96), rgba(7, 20, 29, 0.98)),
      linear-gradient(90deg, rgba(49, 199, 191, 0.08), transparent 30%);
    border: 1px solid rgba(145, 192, 215, 0.14);
    box-shadow: var(--shadow);
    position: relative;
    overflow: hidden;
  }

  .sheet::before,
  .sheet::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .sheet::before {
    width: 320px;
    height: 320px;
    top: -170px;
    right: -110px;
    background: radial-gradient(circle, rgba(49, 199, 191, 0.18), transparent 68%);
  }

  .sheet::after {
    width: 260px;
    height: 260px;
    bottom: -150px;
    left: -90px;
    background: radial-gradient(circle, rgba(103, 183, 255, 0.14), transparent 68%);
  }

  .hero-grid,
  .split-2,
  .split-3,
  .card-grid,
  .metric-grid,
  .micro-grid,
  .peer-grid,
  .trend-grid,
  .form-grid,
  .checkbox-grid,
  .link-set,
  .phase-grid {
    display: grid;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .hero-grid {
    grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  }

  .split-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .split-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .card-grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .micro-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .peer-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .trend-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .form-grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }

  .checkbox-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .link-set {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .phase-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-panel,
  .side-panel,
  .card,
  .metric,
  .micro,
  .peer-card,
  .trend-card,
  .status-box,
  .details-card,
  .field,
  .empty-state {
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--panel);
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
  }

  .hero-panel,
  .side-panel,
  .card,
  .metric,
  .micro,
  .peer-card,
  .trend-card,
  .status-box,
  .empty-state {
    padding: 22px;
  }

  .hero-panel {
    background:
      linear-gradient(140deg, rgba(14, 38, 53, 0.98), rgba(7, 22, 31, 0.98)),
      linear-gradient(90deg, rgba(49, 199, 191, 0.1), transparent);
  }

  .side-panel {
    background:
      linear-gradient(160deg, rgba(10, 29, 40, 0.98), rgba(7, 20, 29, 0.98)),
      linear-gradient(180deg, rgba(103, 183, 255, 0.08), transparent);
  }

  .eyebrow,
  .section-eyebrow,
  .card-topline,
  .metric-label,
  .micro-label,
  .meta-label,
  .details-kicker {
    display: inline-block;
    color: var(--teal);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 11px;
    font-weight: 800;
  }

  .section-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: end;
    gap: 14px;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .section-copy,
  .hero-copy,
  .card-copy,
  .metric-copy,
  .micro-copy,
  .subtle,
  .field-note,
  .status-copy,
  .empty-copy {
    color: #dceaf2;
    font-size: 15px;
    line-height: 1.7;
  }

  .subtle,
  .field-note,
  .status-copy,
  .empty-copy {
    color: var(--muted);
  }

  .hero-copy {
    max-width: 760px;
    margin-top: 12px;
  }

  .callout {
    margin-top: 16px;
    padding: 16px 18px;
    border-radius: 20px;
    border-left: 4px solid var(--teal);
    background: rgba(255, 255, 255, 0.035);
    color: #bfe7ef;
    font-size: 16px;
    line-height: 1.7;
  }

  .meta-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .meta-pill {
    padding: 10px 12px;
    border-radius: 16px;
    border: 1px solid rgba(145, 192, 215, 0.12);
    background: rgba(255, 255, 255, 0.035);
    min-width: 136px;
  }

  .meta-value {
    display: block;
    margin-top: 6px;
    color: var(--ink);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.45;
  }

  .score-panel {
    display: grid;
    gap: 16px;
  }

  .score-orb {
    display: grid;
    place-items: center;
    min-height: 180px;
    border-radius: 28px;
    background:
      radial-gradient(circle at 32% 22%, rgba(49, 199, 191, 0.22), transparent 40%),
      linear-gradient(165deg, rgba(22, 56, 74, 0.96), rgba(8, 25, 35, 0.98));
    border: 1px solid rgba(145, 192, 215, 0.18);
  }

  .score-value {
    font-size: clamp(58px, 7vw, 88px);
    line-height: 0.9;
    color: var(--teal);
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    font-weight: 800;
  }

  .score-caption {
    margin-top: 6px;
    color: var(--muted);
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
  }

  .metric-value,
  .micro-value {
    color: var(--ink);
    font-size: 32px;
    line-height: 1;
    font-weight: 800;
    margin-top: 10px;
  }

  .metric-value {
    color: var(--teal);
  }

  .micro-value {
    font-size: 28px;
  }

  .meter {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
    margin-top: 14px;
  }

  .meter-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--teal), #84d9ff);
  }

  .meter-fill.good {
    background: linear-gradient(90deg, var(--lime), #b9ff9e);
  }

  .meter-fill.watch {
    background: linear-gradient(90deg, var(--amber), #ffd48d);
  }

  .meter-fill.risk {
    background: linear-gradient(90deg, var(--orange), #ffb293);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .badge-good {
    background: var(--lime-soft);
    border-color: rgba(142, 217, 124, 0.18);
    color: var(--lime);
  }

  .badge-watch {
    background: var(--amber-soft);
    border-color: rgba(240, 191, 105, 0.18);
    color: var(--amber);
  }

  .badge-risk {
    background: var(--orange-soft);
    border-color: rgba(243, 139, 99, 0.18);
    color: var(--orange);
  }

  .badge-neutral {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(145, 192, 215, 0.12);
    color: var(--muted);
  }

  .card-span-3 { grid-column: span 3; }
  .card-span-4 { grid-column: span 4; }
  .card-span-5 { grid-column: span 5; }
  .card-span-6 { grid-column: span 6; }
  .card-span-7 { grid-column: span 7; }
  .card-span-8 { grid-column: span 8; }
  .card-span-9 { grid-column: span 9; }
  .card-span-12 { grid-column: span 12; }

  .stack {
    display: grid;
    gap: 14px;
  }

  .compact-stack {
    display: grid;
    gap: 10px;
  }

  .keyline {
    height: 1px;
    background: rgba(145, 192, 215, 0.12);
    margin: 2px 0;
  }

  .player-row,
  .match-row,
  .peer-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .player-name,
  .peer-name {
    font-weight: 700;
    color: var(--ink);
  }

  .player-meta,
  .peer-meta {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .table-wrap {
    position: relative;
    z-index: 1;
    overflow-x: auto;
    border-radius: 20px;
    border: 1px solid rgba(145, 192, 215, 0.12);
    background: rgba(255, 255, 255, 0.02);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
  }

  th, td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(145, 192, 215, 0.10);
    text-align: left;
    vertical-align: top;
    font-size: 14px;
    line-height: 1.55;
  }

  th {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.04);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .empty-cell {
    color: var(--muted);
    text-align: center;
    padding: 28px 16px;
  }

  .inline-score {
    font-weight: 800;
    color: var(--teal);
  }

  .search-shell {
    margin-top: 20px;
    display: grid;
    gap: 12px;
  }

  .search-input-row,
  .action-row,
  .inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .search-results {
    display: grid;
    gap: 12px;
  }

  .result-card {
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(145, 192, 215, 0.12);
  }

  .result-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    color: var(--ink);
    font-size: 16px;
  }

  .result-link:hover {
    color: var(--sky);
    text-decoration: none;
  }

  .result-meta {
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.6;
  }

  .trend-bars {
    display: flex;
    align-items: end;
    gap: 8px;
    min-height: 104px;
    margin-top: 18px;
  }

  .trend-column {
    flex: 1;
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .trend-bar {
    width: 100%;
    min-height: 14px;
    border-radius: 999px 999px 10px 10px;
    background: linear-gradient(180deg, rgba(132, 217, 255, 0.94), rgba(49, 199, 191, 0.52));
  }

  .trend-label {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
    text-align: center;
  }

  .trend-point {
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  .trend-note {
    margin-top: 12px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.6;
  }

  .peer-card.subject {
    background:
      linear-gradient(160deg, rgba(20, 52, 70, 0.98), rgba(10, 27, 38, 0.98)),
      linear-gradient(90deg, rgba(49, 199, 191, 0.1), transparent);
    border-color: rgba(49, 199, 191, 0.22);
  }

  .recommendation {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 999px;
    background: var(--lime-soft);
    border: 1px solid rgba(142, 217, 124, 0.20);
    color: var(--lime);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  .details-card {
    padding: 0;
    overflow: hidden;
  }

  .details-card > summary {
    list-style: none;
    padding: 18px 20px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
  }

  .details-card > summary::-webkit-details-marker {
    display: none;
  }

  .details-title {
    display: grid;
    gap: 6px;
  }

  .details-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .details-body {
    padding: 18px;
    display: grid;
    gap: 16px;
  }

  .field {
    padding: 16px;
    display: grid;
    gap: 8px;
  }

  .field label,
  .field .field-label {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 800;
  }

  input,
  textarea,
  select,
  button {
    font: inherit;
  }

  input,
  textarea,
  select {
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(145, 192, 215, 0.16);
    background: rgba(4, 16, 24, 0.82);
    color: var(--ink);
  }

  input::placeholder,
  textarea::placeholder {
    color: rgba(157, 182, 198, 0.72);
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid rgba(49, 199, 191, 0.28);
    border-color: rgba(49, 199, 191, 0.32);
  }

  textarea {
    min-height: 110px;
    resize: vertical;
  }

  .checkbox-field {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .checkbox-field input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
  }

  .button,
  button {
    border: 0;
    border-radius: 999px;
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 12px;
    color: #06202c;
    background: linear-gradient(135deg, var(--teal), #84d9ff);
    box-shadow: 0 10px 24px rgba(49, 199, 191, 0.18);
  }

  .button.secondary,
  button.secondary {
    background: linear-gradient(135deg, var(--amber), #ffd28b);
    box-shadow: 0 10px 24px rgba(240, 191, 105, 0.18);
  }

  .button.ghost,
  button.ghost {
    color: var(--ink);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(145, 192, 215, 0.16);
    box-shadow: none;
  }

  button:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .status-box pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #d8f1fb;
    font-size: 13px;
    line-height: 1.7;
    font-family: "SFMono-Regular", "Consolas", monospace;
  }

  .mono {
    font-family: "SFMono-Regular", "Consolas", monospace;
    font-size: 12px;
    color: var(--muted);
  }

  .inline-note {
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted);
  }

  .hidden {
    display: none !important;
  }

  .right {
    text-align: right;
  }

  @media (max-width: 1120px) {
    .hero-grid,
    .trend-grid,
    .peer-grid,
    .metric-grid,
    .micro-grid,
    .phase-grid,
    .split-2,
    .split-3,
    .link-set,
    .checkbox-grid {
      grid-template-columns: 1fr 1fr;
    }

    .card-span-3,
    .card-span-4,
    .card-span-5,
    .card-span-6,
    .card-span-7,
    .card-span-8,
    .card-span-9 {
      grid-column: span 12;
    }
  }

  @media (max-width: 760px) {
    .page-shell {
      width: min(100%, calc(100% - 18px));
      margin: 10px auto 20px;
    }

    .sheet,
    .chrome {
      padding: 14px;
      border-radius: 24px;
    }

    .hero-grid,
    .split-2,
    .split-3,
    .metric-grid,
    .micro-grid,
    .peer-grid,
    .trend-grid,
    .phase-grid,
    .checkbox-grid,
    .link-set {
      grid-template-columns: 1fr;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    table {
      min-width: 620px;
    }

    .nav,
    .pill-row,
    .action-row,
    .inline-actions,
    .search-input-row {
      width: 100%;
      justify-content: flex-start;
    }
  }
`;

function buildSeriesPath(seriesConfigKey, suffix = "") {
  return `/series/${encodeURIComponent(seriesConfigKey)}${suffix}`;
}

function buildAdminPath(seriesConfigKey, suffix = "") {
  return `/admin/series/${encodeURIComponent(seriesConfigKey)}${suffix}`;
}

function buildApiPath(seriesConfigKey, suffix = "") {
  return `/api/series/${encodeURIComponent(seriesConfigKey)}${suffix}`;
}

function buildDefaultPlayerPath(playerId, divisionId) {
  const base = `/players/${encodeURIComponent(playerId)}`;
  return divisionId ? `${base}?divisionId=${encodeURIComponent(divisionId)}` : base;
}

function buildPlayerReportPath(seriesConfigKey, playerId, divisionId) {
  const base = buildSeriesPath(seriesConfigKey, `/players/${playerId}/report`);
  return divisionId ? `${base}?divisionId=${encodeURIComponent(divisionId)}` : base;
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function displayNumber(value, digits = 1, fallback = "—") {
  const numeric = toNumber(value, null);
  if (numeric === null) {
    return fallback;
  }

  const fixed = numeric.toFixed(digits);
  return fixed
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function displayInteger(value, fallback = "—") {
  const numeric = toInteger(value);
  return numeric === null ? fallback : String(numeric);
}

function displayDataValue(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : displayNumber(value, 4, "0");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => displayDataValue(item)).join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return normalizeText(String(value)) || "—";
}

function percentWidth(value) {
  const numeric = toNumber(value, 0);
  return Math.max(0, Math.min(100, numeric));
}

function toneFromLabel(label) {
  const normalized = normalizeLabel(label);
  if (
    [
      "computed",
      "pass",
      "high",
      "strong",
      "strong consideration",
      "rising",
      "active",
      "force_include",
    ].includes(normalized)
  ) {
    return "good";
  }
  if (
    [
      "warn",
      "warning",
      "pending",
      "medium",
      "watch",
      "steady",
      "auto",
    ].includes(normalized)
  ) {
    return "watch";
  }
  if (
    [
      "limited",
      "risk",
      "force_exclude",
      "error",
      "inactive",
    ].includes(normalized)
  ) {
    return "risk";
  }
  return "neutral";
}

function renderBadge(label, tone = null) {
  const text = normalizeText(label) || "Unknown";
  const resolvedTone = tone || toneFromLabel(text);
  return `<span class="badge badge-${escapeHtml(resolvedTone)}">${escapeHtml(text)}</span>`;
}

function renderPill(item) {
  if (!item) {
    return "";
  }

  if (typeof item === "string") {
    return `<span class="pill">${escapeHtml(item)}</span>`;
  }

  const tone = item.tone ? ` pill-${escapeHtml(item.tone)}` : "";
  const label = normalizeText(item.label);
  const value = normalizeText(item.value);

  return `<span class="pill${tone}">${label ? `<strong>${escapeHtml(label)}:</strong> ` : ""}${escapeHtml(value)}</span>`;
}

function renderMetaStrip(items) {
  return `
    <div class="meta-strip">
      ${items
        .filter((item) => normalizeText(item.value))
        .map(
          (item) => `
            <div class="meta-pill">
              <span class="meta-label">${escapeHtml(item.label)}</span>
              <span class="meta-value">${escapeHtml(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReportHeaderMetaStrip(items) {
  return `
    <div class="report-header-meta-strip">
      ${items
        .filter((item) => normalizeText(item.value))
        .map(
          (item) => `
            <div class="report-header-meta-pill${item.performance ? " report-header-meta-pill-performance" : ""}">
              <span class="report-header-meta-label">${escapeHtml(item.label)}</span>
              <span class="report-header-meta-value">${escapeHtml(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMetricCard(input) {
  const tone = input.tone || toneForScore(toNumber(input.value, 0));
  return `
    <article class="metric">
      <span class="metric-label">${escapeHtml(input.label)}</span>
      <div class="metric-value">${escapeHtml(displayNumber(input.value, input.digits ?? 1, "0"))}</div>
      <div class="meter"><div class="meter-fill ${escapeHtml(tone)}" style="width:${percentWidth(input.value)}%"></div></div>
      <p class="metric-copy">${escapeHtml(normalizeText(input.copy) || "Current live signal from the Supabase-backed analytics layer.")}</p>
    </article>
  `;
}

function renderMicroCard(input) {
  const tone = input.tone || toneForScore(toNumber(input.value, 0));
  return `
    <article class="micro">
      <span class="micro-label">${escapeHtml(input.label)}</span>
      <div class="micro-value">${escapeHtml(displayNumber(input.value, input.digits ?? 1, "0"))}</div>
      <div class="meter"><div class="meter-fill ${escapeHtml(tone)}" style="width:${percentWidth(input.value)}%"></div></div>
      <p class="micro-copy">${escapeHtml(normalizeText(input.copy) || "")}</p>
    </article>
  `;
}

function renderKeyValueTable(items, options = {}) {
  const rows = Array.isArray(items) ? items.filter((item) => normalizeText(item?.label)) : [];
  return renderTable(
    [
      {
        label: "Field",
        render: (row) => `
          <div class="stack" style="gap:6px">
            <span class="card-topline">${escapeHtml(row.label)}</span>
            ${normalizeText(row.copy) ? `<span class="inline-note">${escapeHtml(row.copy)}</span>` : ""}
          </div>
        `,
      },
      {
        label: "Value",
        render: (row) => row.html || `<span class="${row.mono ? "mono" : ""}">${escapeHtml(displayDataValue(row.value))}</span>`,
      },
    ],
    rows,
    { emptyMessage: options.emptyMessage || "No fields available." }
  );
}

function renderTable(columns, rows, options = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            safeRows.length
              ? safeRows
                  .map(
                    (row) => `
                      <tr>
                        ${columns
                          .map(
                            (column) => `
                              <td class="${escapeHtml(column.className || "")}">
                                ${column.render ? column.render(row) : escapeHtml(normalizeText(row[column.key]))}
                              </td>
                            `
                          )
                          .join("")}
                      </tr>
                    `
                  )
                  .join("")
              : `<tr><td colspan="${columns.length}" class="empty-cell">${escapeHtml(
                  options.emptyMessage || "No rows available."
                )}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderTrendCard(trend) {
  const values = Array.isArray(trend.values) ? trend.values : [];
  const maxValue = Math.max(...values.map((item) => toNumber(item.value, 0)), 1);

  return `
    <article class="trend-card">
      <div class="player-row">
        <div class="stack">
          <span class="card-topline">${escapeHtml(trend.status)}</span>
          <h3>${escapeHtml(trend.title)}</h3>
        </div>
        ${renderBadge(trend.status, toneFromLabel(trend.status))}
      </div>
      <div class="trend-bars">
        ${values
          .map((item) => {
            const height = Math.max(14, Math.round((toNumber(item.value, 0) / maxValue) * 100));
            return `
              <div class="trend-column">
                <div class="trend-bar" style="height:${height}px"></div>
                <div class="trend-point">${escapeHtml(displayNumber(item.value, 1, "0"))}</div>
                <div class="trend-label">${escapeHtml(item.label)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
      <p class="trend-note">${escapeHtml(normalizeText(trend.note))}</p>
    </article>
  `;
}

function renderPlayerSearchScript(input) {
  return `
    (() => {
      const endpoint = ${serializeForScript(input.endpoint)};
      const inputEl = document.getElementById(${serializeForScript(input.inputId)});
      const button = document.getElementById(${serializeForScript(input.buttonId)});
      const status = document.getElementById(${serializeForScript(input.statusId)});
      const results = document.getElementById(${serializeForScript(input.resultsId)});
      const linkMode = ${serializeForScript(input.linkMode || "series")};
      const limit = ${serializeForScript(String(input.limit || 8))};
      const idleMessage = ${serializeForScript(input.idleMessage || "Blank search loads the current live leaderboard sample.")};
      const queryMessage = ${serializeForScript(input.queryMessage || "Searching live Supabase-backed player rows...")};
      const emptyMessage = ${serializeForScript(input.emptyMessage || "Try a broader player, team, or spelling match.")};
      let timer = null;

      function buildReportHref(item) {
        if (linkMode === "default") {
          const base = "/players/" + encodeURIComponent(item.playerId);
          return item.divisionId ? base + "?divisionId=" + encodeURIComponent(item.divisionId) : base;
        }
        return item.reportPath || "#";
      }

      function clearResults(message) {
        results.innerHTML = "";
        if (message) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML = "<span class='card-topline'>Search</span><h3>No matching players found.</h3><p class='empty-copy'>" + message + "</p>";
          results.appendChild(empty);
        }
      }

      function renderRows(items) {
        results.innerHTML = "";
        items.forEach((item) => {
          const card = document.createElement("article");
          card.className = "result-card";

          const link = document.createElement("a");
          link.className = "result-link";
          link.href = buildReportHref(item);
          link.textContent = item.displayName;

          const meta = document.createElement("div");
          meta.className = "result-meta";
          meta.textContent = [item.teamName, item.divisionLabel, item.roleLabel].filter(Boolean).join(" • ");

          const score = document.createElement("div");
          score.className = "result-meta";
          score.textContent = "Composite " + item.compositeScore + " • Percentile " + item.percentileRank + " • Confidence " + item.confidenceLabel;

          const actions = document.createElement("div");
          actions.className = "action-row";

          const reportLink = document.createElement("a");
          reportLink.className = "button";
          reportLink.href = buildReportHref(item);
          reportLink.textContent = "Open Report";

          const apiLink = document.createElement("a");
          apiLink.className = "button ghost";
          apiLink.href = item.apiPath || "#";
          apiLink.textContent = "Open JSON";

          actions.appendChild(reportLink);
          if (item.apiPath) {
            actions.appendChild(apiLink);
          }

          card.appendChild(link);
          card.appendChild(meta);
          card.appendChild(score);
          card.appendChild(actions);
          results.appendChild(card);
        });
      }

      async function runSearch() {
        const query = inputEl.value.trim();
        status.textContent = query ? queryMessage : idleMessage;
        try {
          const response = await fetch(endpoint + "?q=" + encodeURIComponent(query) + "&limit=" + encodeURIComponent(limit));
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "Search request failed.");
          }

          if (!payload.results || !payload.results.length) {
            clearResults(query ? emptyMessage : "No leaderboard rows are available.");
            status.textContent = "No player rows returned.";
            return;
          }

          renderRows(payload.results);
          status.textContent = payload.resultCount + " player rows returned from live analytics.";
        } catch (error) {
          clearResults("The search call failed. Check the API route or database connection.");
          status.textContent = error.message;
        }
      }

      button.addEventListener("click", runSearch);
      inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch();
        }
      });
      inputEl.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(runSearch, 180);
      });

      runSearch();
    })();
  `;
}

function renderDocument(input) {
  const navItems = input.seriesConfigKey
    ? [
        { key: "dashboard", label: "Dashboard", href: buildSeriesPath(input.seriesConfigKey, "/dashboard") },
        { key: "setup", label: "Setup", href: buildAdminPath(input.seriesConfigKey, "/setup") },
        { key: "tuning", label: "Tuning", href: buildAdminPath(input.seriesConfigKey, "/tuning") },
        { key: "matches", label: "Match Ops", href: buildAdminPath(input.seriesConfigKey, "/matches") },
      ]
    : [];

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(input.title)}</title>
        <meta name="description" content="${escapeHtml(normalizeText(input.description) || "Game-Changrs Cricket Analytics private surface")}">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>${BASE_CSS}</style>
      </head>
      <body>
        <div class="page-shell">
          <header class="chrome">
            <div class="brand">
              <div class="brand-mark">GC</div>
              <div class="brand-copy">
                <span class="brand-title">Game-Changrs Private</span>
                <span class="brand-subtitle">${escapeHtml(
                  normalizeText(input.seriesName) || "Cricket Analytics Control Surface"
                )}</span>
              </div>
            </div>
            ${
              navItems.length
                ? `
                  <nav class="nav">
                    ${navItems
                      .map(
                        (item) => `
                          <a class="nav-link${item.key === input.activeNav ? " active" : ""}" href="${escapeHtml(item.href)}">
                            ${escapeHtml(item.label)}
                          </a>
                        `
                      )
                      .join("")}
                  </nav>
                `
                : ""
            }
            <div class="pill-row">${(input.pills || []).map(renderPill).join("")}</div>
          </header>
          ${input.hero || ""}
          ${input.content || ""}
        </div>
        ${input.scripts ? `<script>${input.scripts}</script>` : ""}
      </body>
    </html>
  `;
}

function renderSeriesIndexPage(data) {
  const cards = Array.isArray(data.seriesCards) ? data.seriesCards : [];
  const activeOverview = data.activeOverview || {};
  const activeSeriesOverview = activeOverview.series || {};
  const qualitySummary = activeOverview.qualitySummary || {};
  const leaderboard = Array.isArray(activeOverview.leaderboard) ? activeOverview.leaderboard : [];
  const recentMatches = Array.isArray(activeOverview.recentMatches) ? activeOverview.recentMatches : [];
  const totalMatches = cards.reduce((sum, card) => sum + (toInteger(card.matchCount) || 0), 0);
  const computedMatches = cards.reduce((sum, card) => sum + (toInteger(card.computedMatches) || 0), 0);
  const totalPlayers = cards.reduce((sum, card) => sum + (toInteger(card.playerCount) || 0), 0);
  const activeSeries = cards.find((card) => card.isActive) || cards[0] || {};
  const computedCoverage = totalMatches ? (computedMatches / totalMatches) * 100 : 0;
  const featuredPlayers = leaderboard.slice(0, 6);
  const activeSeriesConfigKey = activeSeriesOverview.configKey || activeSeries.configKey || "";
  const recentMatchesTable = renderTable(
    [
      { label: "Date", render: (row) => escapeHtml(row.matchDateLabel || formatDate(row.matchDate)) },
      {
        label: "Match",
        render: (row) => `
          <div class="stack">
            <strong>${escapeHtml(row.matchTitle)}</strong>
            <span class="player-meta">${escapeHtml([row.divisionLabel, row.sourceMatchId].filter(Boolean).join(" • "))}</span>
          </div>
        `,
      },
      { label: "Result", render: (row) => escapeHtml(row.resultText || "No result text") },
      { label: "Reconcile", render: (row) => renderBadge(row.reconciliationStatus, toneFromLabel(row.reconciliationStatus)) },
      { label: "Analytics", render: (row) => renderBadge(row.analyticsStatus, toneFromLabel(row.analyticsStatus)) },
    ],
    recentMatches.slice(0, 6),
    { emptyMessage: "No recent matches are available for the active series." }
  );

  return renderDocument({
    title: "Game-Changrs Cricket Analytics",
    description: "Private entry point for the Bay Area U15 cricket intelligence surfaces.",
    seriesName: activeSeriesOverview.name || activeSeries.seriesName || "Cricket Analytics Control Surface",
    pills: [
      { value: "Executive Overview" },
      { label: "Series", value: String(cards.length) || "0" },
      { label: "Matches", value: displayInteger(totalMatches, "0"), tone: computedMatches === totalMatches && totalMatches ? "good" : "watch" },
      { label: "Players", value: displayInteger(totalPlayers, "0") },
    ],
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">What This App Really Is</span>
            <h1>From raw cricket site data to trusted analytics intelligence, starting with CricClubs.</h1>
            <p class="hero-copy">
              A private decision-support app that turns raw cricket data into fairer player evaluation.
              The first live use case is Bay Area U15, but the structure is meant for coach-ready and selector-ready
              intelligence surfaces that can expand beyond one series.
            </p>
            <div class="callout">
              CricClubs shows what happened. This app shows what matters.
            </div>
            ${renderMetaStrip([
              { label: "Primary User", value: "Selectors and Coaches" },
              { label: "Core Edge", value: "Ball-by-ball and opponent-adjusted analytics" },
              { label: "First Live Slice", value: activeSeriesOverview.name || activeSeries.seriesName || "Bay Area U15" },
            ])}
          </div>
          <aside class="side-panel stack">
            <div>
              <span class="card-topline">Success Definition</span>
              <h3>One coach-trusted player report from real match data.</h3>
            </div>
            <p class="section-copy">
              Supabase is the live source of truth. Extraction, parsing, refresh catch-up, and analytics recompute are
              already complete. The current work is about surfacing those outputs cleanly and credibly.
            </p>
            ${renderKeyValueTable([
              { label: "Private Access", value: "Internal Game-Changrs surface only" },
              { label: "Trusted Data", value: `${displayInteger(computedMatches, "0")} computed matches currently live` },
              { label: "Portable Direction", value: "Designed to move into the private Game-Changrs repo when ready" },
            ])}
          </aside>
        </div>
        <div class="micro-grid" style="margin-top:16px">
          <article class="micro">
            <span class="micro-label">First Use Case</span>
            <div class="micro-value">${escapeHtml(activeSeriesOverview.targetAgeGroup || activeSeries.targetAgeGroup || "U15")}</div>
            <p class="micro-copy">${escapeHtml(`${activeSeriesOverview.name || activeSeries.seriesName || "Bay Area"} live slice.`)}</p>
          </article>
          <article class="micro">
            <span class="micro-label">Core Edge</span>
            <div class="micro-value">Ball-by-Ball</div>
            <p class="micro-copy">Pressure, control, matchup, and phase context.</p>
          </article>
          <article class="micro">
            <span class="micro-label">Decision Lens</span>
            <div class="micro-value">Opponent-Adjusted</div>
            <p class="micro-copy">Strong opposition counts more.</p>
          </article>
          ${renderMicroCard({
            label: "Live Coverage",
            value: computedCoverage,
            digits: 0,
            copy: `${displayInteger(computedMatches, "0")} of ${displayInteger(totalMatches, "0")} matches computed.`,
            tone: computedCoverage >= 100 ? "good" : "watch",
          })}
        </div>
      </section>
    `,
    content: `
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Executive Summary</span>
            <h2>Key Outcomes You Should Expect</h2>
            <p class="section-copy">Faster understanding, better trust, and fairer comparison.</p>
          </div>
        </div>
        <div class="card-grid">
          <article class="card card-span-4">
            <span class="card-topline">01</span>
            <h3>Trusted Player Intelligence</h3>
            <p class="card-copy">Every key match, innings, and ball becomes structured, reusable data instead of one-off scraping output.</p>
          </article>
          <article class="card card-span-4">
            <span class="card-topline">02</span>
            <h3>Fairer Evaluation</h3>
            <p class="card-copy">Players are judged by opposition quality, phase, matchup, and match impact, not just raw totals.</p>
          </article>
          <article class="card card-span-4">
            <span class="card-topline">03</span>
            <h3>Coach-Ready Reporting</h3>
            <p class="card-copy">Search a player and get the full story in one decision-ready view with evidence and drilldowns behind it.</p>
          </article>
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Current Live Series</span>
            <h2>${escapeHtml(activeSeriesOverview.name || activeSeries.seriesName || "Bay Area U15")}</h2>
            <p class="section-copy">This local app is currently reading the live Supabase-backed Bay Area U15 dataset and using the existing selector-report service layer.</p>
          </div>
          ${
            activeSeriesOverview.configKey || activeSeries.configKey
              ? `<div class="action-row">
                  <a class="button" href="${escapeHtml(buildSeriesPath(activeSeriesOverview.configKey || activeSeries.configKey, "/dashboard"))}">Open Full Dashboard</a>
                  <a class="button ghost" href="${escapeHtml(buildApiPath(activeSeriesOverview.configKey || activeSeries.configKey, "/dashboard/overview"))}">Open Series JSON</a>
                </div>`
              : ""
          }
        </div>
        <div class="metric-grid">
          ${renderMetricCard({ label: "Matches", value: qualitySummary.totalMatches || activeSeries.matchCount || 0, digits: 0, copy: "Matches currently attached to the active live series.", tone: "good" })}
          ${renderMetricCard({ label: "Computed", value: qualitySummary.computedMatches || activeSeries.computedMatches || 0, digits: 0, copy: "Matches with computed analytics status.", tone: (qualitySummary.computedMatches || activeSeries.computedMatches || 0) === (qualitySummary.totalMatches || activeSeries.matchCount || 0) ? "good" : "watch" })}
          ${renderMetricCard({ label: "Warnings", value: qualitySummary.warningMatches || 0, digits: 0, copy: "Matches currently flagged at reconciliation stage.", tone: toInteger(qualitySummary.warningMatches) ? "watch" : "good" })}
          ${renderMetricCard({ label: "Pending Ops", value: qualitySummary.pendingOps || 0, digits: 0, copy: "Refresh or recompute operations still pending.", tone: toInteger(qualitySummary.pendingOps) ? "watch" : "good" })}
        </div>
        <div class="split-2" style="margin-top:16px">
          <article class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Dataset Context</span>
              <h3>What A Selector Is Looking At</h3>
            </div>
            ${renderKeyValueTable([
              { label: "Series Name", value: activeSeriesOverview.name || activeSeries.seriesName },
              { label: "Series Key", value: activeSeriesOverview.configKey || activeSeries.configKey, mono: true },
              { label: "Target Age Group", value: activeSeriesOverview.targetAgeGroup || activeSeries.targetAgeGroup || "U15" },
              { label: "Source Of Truth", value: "Supabase live analytics tables" },
              { label: "Match Coverage", value: `${displayInteger(qualitySummary.computedMatches || activeSeries.computedMatches || 0, "0")} computed of ${displayInteger(qualitySummary.totalMatches || activeSeries.matchCount || 0, "0")}` },
              { label: "Active Player Rows", value: displayInteger(activeSeries.playerCount, "0") },
            ])}
            <div class="callout">
              This is the first local app surface on top of the existing Bay Area U15 dataset. It is not re-scraping CricClubs. It is reading the already-computed analytics layer.
            </div>
          </article>
          <article class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Player Entry</span>
              <h3>Search The Live Player Pool</h3>
            </div>
            <div class="search-shell">
              <div class="search-input-row">
                <input id="home-player-search-input" type="search" placeholder="Search players, for example Shreyak Porecha">
                <button id="home-player-search-button" type="button">Search</button>
              </div>
              <div id="home-player-search-status" class="inline-note">Blank search loads the current live leaderboard sample.</div>
              <div id="home-player-search-results" class="search-results"></div>
            </div>
          </article>
        </div>
      </section>
      <section class="sheet">
        <div class="split-2">
          <article class="card stack">
            <div class="stack">
              <span class="section-eyebrow">What This Analytics Delivers</span>
              <h2>Selector-Focused Intelligence</h2>
            </div>
            <p class="card-copy">
              This platform converts cricket site data such as CricClubs pages, scorecards, statistics tables, and
              commentary into a structured player-intelligence layer for Bay Area U15 cricket.
            </p>
            <p class="card-copy">
              It supports player search, comparison, ranking, and report generation with a clear explanation of why a
              player is being rated highly or flagged for further attention.
            </p>
          </article>
          <article class="card stack">
            <div class="stack">
              <span class="section-eyebrow">Why This Is Different</span>
              <h2>Two Similar Scorecards Can Mean Very Different Things</h2>
            </div>
            ${renderMetaStrip([
              { label: "Signal", value: "Pressure creation" },
              { label: "Signal", value: "Matchup intelligence" },
              { label: "Signal", value: "Quality of opposition" },
              { label: "Signal", value: "Development tracking" },
            ])}
            <div class="callout">
              Two players can post similar scorecard totals and still have very different selector value. This system
              is designed to reveal that difference quickly.
            </div>
          </article>
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">How The App Creates Meaning</span>
            <h2>Messy web pages in. Trusted decisions out.</h2>
            <p class="section-copy">The runtime is already past data collection and focused on serving validated intelligence.</p>
          </div>
        </div>
        <div class="card-grid">
          <article class="card card-span-3">
            <span class="card-topline">Stage 1</span>
            <h3>Discover</h3>
            <p class="card-copy">Find divisions, matches, scorecards, commentary, teams, and players from the live competition slice.</p>
          </article>
          <article class="card card-span-3">
            <span class="card-topline">Stage 2</span>
            <h3>Validate</h3>
            <p class="card-copy">Parse and reconcile before analytics are trusted so reporting stays tied to official match records.</p>
          </article>
          <article class="card card-span-3">
            <span class="card-topline">Stage 3</span>
            <h3>Interpret</h3>
            <p class="card-copy">Compute matchup, opponent-adjusted, form, leverage, and consistency metrics from the structured data.</p>
          </article>
          <article class="card card-span-3">
            <span class="card-topline">Stage 4</span>
            <h3>Decide</h3>
            <p class="card-copy">Publish private dashboards and reports that explain the rating instead of hiding the reasoning.</p>
          </article>
        </div>
      </section>
      <section class="sheet">
        <div class="split-2">
          <article class="card stack">
            <div class="stack">
              <span class="section-eyebrow">Why Ball-by-Ball Matters</span>
              <h2>Delivery-Level Context Changes The Read</h2>
            </div>
            ${renderTable(
              [
                { label: "Capability", render: (row) => escapeHtml(row.capability) },
                { label: "What It Measures", render: (row) => escapeHtml(row.measure) },
                { label: "Why It Matters", render: (row) => escapeHtml(row.impact) },
              ],
              [
                { capability: "Pressure profile", measure: "Dot-ball rate, release balls, pressure overs, control windows", impact: "Shows whether a player is actually driving the contest, not just appearing in the score summary" },
                { capability: "Matchup quality", measure: "Batter vs bowler outcomes by opponent strength and phase", impact: "Lets selectors see how players hold up against the people they will face at stronger levels" },
                { capability: "Run attribution", measure: "Separates batter runs from byes, leg-byes, wides, and no-balls", impact: "Prevents misleading conclusions from raw scorecard totals" },
              ]
            )}
          </article>
          <article class="card stack">
            <div class="stack">
              <span class="section-eyebrow">Why Opponent-Adjusted Matters</span>
              <h2>Not All 40s Or 2-Wicket Spells Mean The Same Thing</h2>
            </div>
            ${renderTable(
              [
                { label: "Adjustment", render: (row) => escapeHtml(row.adjustment) },
                { label: "Applied To", render: (row) => escapeHtml(row.appliedTo) },
              ],
              [
                { adjustment: "Team strength", appliedTo: "Runs, wickets, economy, and strike rate against stronger teams" },
                { adjustment: "Division and phase strength", appliedTo: "Extra emphasis on Div 1 and especially Div 1 Phase 2 performances" },
                { adjustment: "Opponent player quality", appliedTo: "Runs vs elite bowlers, wickets of elite batters, control vs strong opponents" },
                { adjustment: "Match impact", appliedTo: "Contributions in meaningful overs and pressure scenarios" },
              ]
            )}
            <p class="card-copy">
              Opponent-adjusted analytics makes visible the difference between output collected in weaker settings and
              output earned against players and teams that matter more for selector decisions.
            </p>
          </article>
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Featured Player Entry</span>
            <h2>Top Live Selector Profiles</h2>
            <p class="section-copy">Direct entry into the current high-value player reports from the active Bay Area U15 sample.</p>
          </div>
        </div>
        <div class="card-grid">
          ${
            featuredPlayers.length
              ? featuredPlayers
                  .map(
                    (item) => `
                      <article class="card card-span-4">
                        <div class="player-row">
                          <div class="stack">
                            <span class="card-topline">${escapeHtml(item.roleLabel || humanizeRole(item.roleType))}</span>
                            <h3>${escapeHtml(item.displayName)}</h3>
                          </div>
                          ${renderBadge(item.confidenceLabel, toneFromLabel(item.confidenceLabel))}
                        </div>
                        <p class="card-copy">${escapeHtml([item.teamName, item.divisionLabel].filter(Boolean).join(" • "))}</p>
                        <div class="metric-grid" style="margin-top:16px">
                          ${renderMetricCard({ label: "Composite", value: item.compositeScore, digits: 1, copy: "Primary-role selector score from the live season model." })}
                          ${renderMetricCard({ label: "Percentile", value: item.percentileRank, digits: 1, copy: "Current ranking position inside the comparison pool." })}
                        </div>
                        <div class="action-row" style="margin-top:16px">
                          <a class="button" href="${escapeHtml(buildDefaultPlayerPath(item.playerId, item.divisionId))}">Open Player Report</a>
                          <a class="button ghost" href="${escapeHtml(buildApiPath(activeSeriesConfigKey, `/players/${item.playerId}/report?divisionId=${item.divisionId}`))}">Open JSON</a>
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `
                  <div class="empty-state card-span-12">
                    <span class="card-topline">No Leaderboard Rows</span>
                    <h3>The active series did not return featured player rows.</h3>
                    <p class="empty-copy">Use the player search above once the live series overview returns leaderboard data.</p>
                  </div>
                `
          }
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Recent Match Readout</span>
            <h2>Current Dataset Status</h2>
            <p class="section-copy">Recent live matches from the active series so selectors can see what competition slice this app is using.</p>
          </div>
          ${
            activeSeriesOverview.configKey || activeSeries.configKey
              ? `<a class="button ghost" href="${escapeHtml(buildAdminPath(activeSeriesOverview.configKey || activeSeries.configKey, "/matches"))}">Open Match Ops</a>`
              : ""
          }
        </div>
        ${recentMatchesTable}
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Series Index</span>
            <h2>Configured Competitions</h2>
            <p class="section-copy">Current live series configurations discovered from the database.</p>
          </div>
        </div>
        <div class="card-grid">
          ${
            cards.length
              ? cards
                  .map(
                    (card) => `
                      <article class="card card-span-6">
                        <div class="player-row">
                          <div class="stack">
                            <span class="card-topline">${escapeHtml(card.targetAgeGroup || "Series")}</span>
                            <h3>${escapeHtml(card.seriesName)}</h3>
                          </div>
                          ${renderBadge(card.isActive ? "Active" : "Inactive", card.isActive ? "good" : "risk")}
                        </div>
                        <p class="card-copy">${escapeHtml(card.configKey)}</p>
                        <div class="metric-grid" style="margin-top:16px">
                          ${renderMetricCard({ label: "Players", value: card.playerCount, digits: 0, copy: "Composite-score rows currently available." })}
                          ${renderMetricCard({ label: "Matches", value: card.matchCount, digits: 0, copy: "Matches attached to this series." })}
                          ${renderMetricCard({ label: "Computed", value: card.computedMatches, digits: 0, copy: "Matches with computed analytics status." })}
                          ${renderMetricCard({ label: "Coverage", value: card.matchCount ? (card.computedMatches / card.matchCount) * 100 : 0, digits: 0, copy: "Computed-match coverage." })}
                        </div>
                        <div class="action-row" style="margin-top:16px">
                          <a class="button" href="${escapeHtml(buildSeriesPath(card.configKey, "/dashboard"))}">Open Dashboard</a>
                          <a class="button ghost" href="${escapeHtml(buildAdminPath(card.configKey, "/setup"))}">Admin Setup</a>
                          <a class="button ghost" href="${escapeHtml(buildAdminPath(card.configKey, "/matches"))}">Match Ops</a>
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `
                  <div class="empty-state card-span-12">
                    <span class="card-topline">No Configurations</span>
                    <h3>No series_source_config rows are available.</h3>
                    <p class="empty-copy">Create a source configuration in Supabase before the dashboard routes can be used.</p>
                  </div>
                `
          }
        </div>
      </section>
    `,
    scripts: renderPlayerSearchScript({
      endpoint: "/api/players/search",
      inputId: "home-player-search-input",
      buttonId: "home-player-search-button",
      statusId: "home-player-search-status",
      resultsId: "home-player-search-results",
      linkMode: "default",
      limit: 8,
      idleMessage: "Blank search loads the current live leaderboard sample.",
      queryMessage: "Searching the live Bay Area U15 player pool...",
      emptyMessage: "Try a broader player, team, or spelling match.",
    }),
  });
}

function renderDashboardPage(payload) {
  const series = payload.series || {};
  const reportProfile = payload.reportProfile || {};
  const quality = payload.qualitySummary || {};
  const leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
  const recentMatches = Array.isArray(payload.recentMatches) ? payload.recentMatches : [];
  const roleLeaders = Object.entries(payload.roleLeaders || {});

  const leaderboardTable = renderTable(
    [
      {
        label: "Player",
        render: (row) => `
          <div class="stack">
            <a class="result-link" href="${escapeHtml(buildPlayerReportPath(series.configKey, row.playerId, row.divisionId))}">
              ${escapeHtml(row.displayName)}
            </a>
            <div class="result-meta">${escapeHtml(
              [row.teamName, row.divisionLabel].filter(Boolean).join(" • ")
            )}</div>
          </div>
        `,
      },
      { label: "Role", render: (row) => escapeHtml(row.roleLabel || humanizeRole(row.roleType)) },
      { label: "Composite", className: "right", render: (row) => `<span class="inline-score">${escapeHtml(displayNumber(row.compositeScore, 1, "0"))}</span>` },
      { label: "Percentile", className: "right", render: (row) => escapeHtml(displayNumber(row.percentileRank, 1, "0")) },
      { label: "Confidence", render: (row) => renderBadge(row.confidenceLabel, toneFromLabel(row.confidenceLabel)) },
    ],
    leaderboard,
    { emptyMessage: "No composite-score rows are available for this series." }
  );

  const recentMatchesTable = renderTable(
    [
      { label: "Date", render: (row) => escapeHtml(row.matchDateLabel || formatDate(row.matchDate)) },
      {
        label: "Match",
        render: (row) => `
          <div class="stack">
            <strong>${escapeHtml(row.matchTitle)}</strong>
            <span class="player-meta">${escapeHtml(row.divisionLabel)}</span>
          </div>
        `,
      },
      { label: "Result", render: (row) => escapeHtml(row.resultText || "No result text") },
      { label: "Reconcile", render: (row) => renderBadge(row.reconciliationStatus, toneFromLabel(row.reconciliationStatus)) },
      { label: "Analytics", render: (row) => renderBadge(row.analyticsStatus, toneFromLabel(row.analyticsStatus)) },
    ],
    recentMatches,
    { emptyMessage: "No recent matches were returned for this series." }
  );

  return renderDocument({
    title: `${series.name || "Series"} Dashboard`,
    description: `Selector dashboard for ${series.name || "the configured series"}.`,
    seriesConfigKey: series.configKey,
    seriesName: series.name,
    activeNav: "dashboard",
    pills: [
      { value: normalizeText(series.targetAgeGroup) || "Selector Surface" },
      { label: "Computed", value: `${displayInteger(quality.computedMatches, "0")}/${displayInteger(quality.totalMatches, "0")}`, tone: quality.pendingOps ? "watch" : "good" },
      { label: "Warnings", value: displayInteger(quality.warningMatches, "0"), tone: toInteger(quality.warningMatches) ? "watch" : "good" },
    ],
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">Selector Dashboard</span>
            <h1>${escapeHtml(series.name || "Selector Dashboard")}</h1>
            <p class="hero-copy">
              Live Supabase-backed entry point for player search, report navigation, leaderboard review,
              and current match-quality checks across the Bay Area U15 competition slice.
            </p>
            ${renderMetaStrip([
              { label: "Report Profile", value: normalizeText(reportProfile.name) || "Executive Selector Default" },
              { label: "Theme", value: normalizeText(reportProfile.theme_name) || "Game-Changrs Executive" },
              { label: "Peer Count", value: displayInteger(reportProfile.peer_count, "3") },
            ])}
            <div class="search-shell">
              <div class="search-input-row">
                <input id="player-search-input" type="search" placeholder="Search players, for example Shreyak Porecha">
                <button id="player-search-button" type="button">Search</button>
                <a class="button ghost" href="${escapeHtml(buildApiPath(series.configKey, "/dashboard/overview"))}">Open JSON</a>
              </div>
              <div id="player-search-status" class="inline-note">Live player search returns the current leaderboard when the query is blank.</div>
              <div id="player-search-results" class="search-results"></div>
            </div>
          </div>
          <aside class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Live Quality Read</span>
              <h3>${escapeHtml(displayInteger(quality.computedMatches, "0"))} of ${escapeHtml(displayInteger(quality.totalMatches, "0"))} matches are computed.</h3>
              <p class="section-copy">This dashboard is reading the same analytics tables used by the worker recompute flow.</p>
            </div>
            <div class="metric-grid">
              ${renderMetricCard({ label: "Pending Ops", value: quality.pendingOps || 0, digits: 0, copy: "Matches needing rescrape, reparse, or recompute.", tone: toInteger(quality.pendingOps) ? "watch" : "good" })}
              ${renderMetricCard({ label: "Overrides", value: quality.adminOverrides || 0, digits: 0, copy: "Admin include/exclude decisions currently active.", tone: toInteger(quality.adminOverrides) ? "watch" : "neutral" })}
              ${renderMetricCard({ label: "Warnings", value: quality.warningMatches || 0, digits: 0, copy: "Refresh-state rows carrying warn reconciliation status.", tone: toInteger(quality.warningMatches) ? "watch" : "good" })}
              ${renderMetricCard({ label: "Coverage %", value: quality.totalMatches ? (quality.computedMatches / quality.totalMatches) * 100 : 0, digits: 0, copy: "Computed-match coverage across this series." })}
            </div>
          </aside>
        </div>
      </section>
    `,
    content: `
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Leaderboard</span>
            <h2>Current Selector Board</h2>
            <p class="section-copy">Top composite-score profiles available in the current live analytics state.</p>
          </div>
        </div>
        ${leaderboardTable}
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Role Leaders</span>
            <h2>Top Players By Primary Role</h2>
            <p class="section-copy">Role-specific panels keep the selector score anchored to the correct player archetype.</p>
          </div>
        </div>
        <div class="card-grid">
          ${
            roleLeaders.length
              ? roleLeaders
                  .map(
                    ([roleKey, rows]) => `
                      <article class="card card-span-6">
                        <div class="stack">
                          <span class="card-topline">${escapeHtml(roleKey.replace(/_/g, " "))}</span>
                          <h3>${escapeHtml(humanizeRole(roleKey, { plural: true }))}</h3>
                        </div>
                        <div class="stack" style="margin-top:16px">
                          ${rows
                            .map(
                              (row, index) => `
                                <div class="result-card">
                                  <div class="player-row">
                                    <div class="stack">
                                      <a class="result-link" href="${escapeHtml(buildPlayerReportPath(series.configKey, row.playerId, row.divisionId))}">
                                        ${escapeHtml(`${index + 1}. ${row.displayName}`)}
                                      </a>
                                      <div class="result-meta">${escapeHtml(
                                        [row.teamName, row.divisionLabel].filter(Boolean).join(" • ")
                                      )}</div>
                                    </div>
                                    <div class="stack" style="justify-items:end">
                                      <span class="inline-score">${escapeHtml(displayNumber(row.compositeScore, 1, "0"))}</span>
                                      <span class="player-meta">Percentile ${escapeHtml(displayNumber(row.percentileRank, 1, "0"))}</span>
                                    </div>
                                  </div>
                                </div>
                              `
                            )
                            .join("")}
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `
                  <div class="empty-state card-span-12">
                    <span class="card-topline">No Role Groups</span>
                    <h3>No role-ranked leaderboard groups were returned.</h3>
                    <p class="empty-copy">The series still has live leaderboard rows, but none grouped cleanly by role type.</p>
                  </div>
                `
          }
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Recent Matches</span>
            <h2>Operational Match Readout</h2>
            <p class="section-copy">Recent live matches with reconciliation and analytics status exposed for fast triage.</p>
          </div>
          <a class="button ghost" href="${escapeHtml(buildAdminPath(series.configKey, "/matches"))}">Open Match Ops</a>
        </div>
        ${recentMatchesTable}
      </section>
    `,
    scripts: renderPlayerSearchScript({
      endpoint: buildApiPath(series.configKey, "/players/search"),
      inputId: "player-search-input",
      buttonId: "player-search-button",
      statusId: "player-search-status",
      resultsId: "player-search-results",
      linkMode: "series",
      limit: 8,
      idleMessage: "Loading the current live leaderboard sample...",
      queryMessage: "Searching live Supabase-backed player rows...",
      emptyMessage: "Try a broader player, team, or spelling match.",
    }),
  });
}

function renderPlayerReportPage(report) {
  const meta = report.meta || {};
  const series = meta.series || {};
  const player = meta.player || {};
  const header = report.header || {};
  const scores = report.scores || {};
  const assessmentSnapshot = Array.isArray(report.assessmentSnapshot) ? report.assessmentSnapshot : [];
  const visualReadout = Array.isArray(report.visualReadout) ? report.visualReadout : [];
  const contextPerformance = Array.isArray(report.contextPerformance) ? report.contextPerformance : [];
  const peerComparison = Array.isArray(report.peerComparison) ? report.peerComparison : [];
  const trends = Array.isArray(report.trends) ? report.trends : [];
  const matchEvidence = Array.isArray(report.matchEvidence) ? report.matchEvidence : [];
  const selectorInterpretation = Array.isArray(report.selectorInterpretation) ? report.selectorInterpretation : [];
  const standardStats = report.standardStats || {};
  const drilldowns = report.drilldowns || {};
  const reportPayload = report.reportPayload || {};
  const payloadPlayerIdentity = reportPayload.playerIdentity || {};
  const payloadComposite = reportPayload.primaryRoleCompositeScore || {};
  const payloadRecommendation = reportPayload.recommendationBadge || {};
  const payloadStrongOpposition = reportPayload.strongOppositionMetrics || {};
  const payloadMatchSituation = reportPayload.matchSituationMetrics || {};
  const payloadDevelopment = reportPayload.developmentAndConsistencyMetrics || {};
  const payloadAssessment = reportPayload.assessmentSnapshot || {};
  const battingVsBowlers = Array.isArray(drilldowns.battingVsBowlers) ? drilldowns.battingVsBowlers : [];
  const bowlingVsBatters = Array.isArray(drilldowns.bowlingVsBatters) ? drilldowns.bowlingVsBatters : [];
  const phasePerformance = drilldowns.phasePerformance || {};
  const overEvidence = drilldowns.overEvidence || {};
  const dismissalFieldingLog = drilldowns.dismissalFieldingLog || {};
  const commentaryEvidence = Array.isArray(drilldowns.commentaryEvidence) ? drilldowns.commentaryEvidence : [];

  const REPORT_NOTE_CSS = `
    .page-title {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 20px;
      margin-bottom: 18px;
      position: relative;
      z-index: 1;
    }

    .page-title h2 {
      margin: 0;
      font-size: 54px;
    }

    .page-title-main {
      flex: 1 1 100%;
      display: grid;
      gap: 10px;
      align-content: start;
    }

    .page-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
    }

    .page-title-side {
      flex: 1 1 42%;
      display: grid;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 24px;
      border: 1px solid rgba(145, 192, 215, 0.14);
      background:
        radial-gradient(circle at top left, rgba(49, 199, 191, 0.14), transparent 28%),
        linear-gradient(160deg, rgba(12, 31, 44, 0.94), rgba(7, 20, 29, 0.98));
      box-shadow: var(--shadow);
    }

    .takeaway-inline {
      max-width: none;
      padding: 0 0 0 2px;
      color: #f2fbff;
      font-size: 20px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .report-header-meta-strip {
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr 1.2fr 0.95fr 0.78fr 0.9fr;
      gap: 12px;
      margin-top: 18px;
      max-width: none;
    }

    .report-header-meta-pill {
      min-width: 0;
      padding: 12px 14px;
      border-radius: 18px;
      border: 1px solid rgba(145, 192, 215, 0.12);
      background: rgba(255, 255, 255, 0.04);
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .report-header-meta-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .report-header-meta-value {
      color: #eef8fc;
      font-size: 15px;
      line-height: 1.5;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .report-header-meta-pill-performance {
      border-color: rgba(138, 217, 124, 0.20);
      background: rgba(138, 217, 124, 0.10);
      box-shadow: inset 0 0 0 1px rgba(138, 217, 124, 0.05);
    }

    .report-header-meta-pill-performance .report-header-meta-label {
      color: rgba(213, 243, 203, 0.82);
    }

    .report-header-meta-pill-performance .report-header-meta-value {
      color: var(--lime);
      text-shadow: 0 0 16px rgba(142, 217, 124, 0.08);
    }

    .recommendation-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      white-space: nowrap;
      border: 1px solid rgba(138, 217, 124, 0.20);
      color: var(--lime);
      background: rgba(138, 217, 124, 0.12);
    }

    .recommendation-badge.badge-watch {
      color: var(--amber);
      background: rgba(240, 179, 95, 0.12);
      border-color: rgba(240, 179, 95, 0.18);
    }

    .recommendation-badge.badge-risk {
      color: var(--orange);
      background: rgba(243, 139, 99, 0.12);
      border-color: rgba(243, 139, 99, 0.18);
    }

    .title-mini-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .title-mini-card {
      border-radius: 18px;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02));
      border: 1px solid rgba(145, 192, 215, 0.12);
      min-height: 78px;
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .title-mini-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .title-mini-value {
      color: #eef8fc;
      font-size: 28px;
      line-height: 1.12;
      font-weight: 800;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
      overflow-wrap: anywhere;
    }

    .title-mini-value.emphasis {
      color: #8ed97c;
      text-shadow: 0 0 18px rgba(142, 217, 124, 0.12);
    }

    .title-mini-value.context {
      color: #dff4ff;
      font-size: 21px;
      line-height: 1.22;
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      font-weight: 700;
    }

    .page-separator {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }

    .page-separator-line {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(103, 183, 255, 0.55), transparent);
    }

    .page-separator-badge {
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(145, 192, 215, 0.14);
      background: rgba(255, 255, 255, 0.04);
      color: #dff0f8;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--muted);
      margin-bottom: 8px;
      font-weight: 700;
    }

    .report-sheet .card {
      background: rgba(12, 31, 44, 0.92);
      padding: 22px;
    }

    .section-banner {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      margin: 20px 0 10px;
      position: relative;
      z-index: 1;
    }

    .section-banner::before,
    .section-banner::after {
      content: "";
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(103, 183, 255, 0.35), transparent);
    }

    .section-banner span {
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(145, 192, 215, 0.14);
      background: rgba(255, 255, 255, 0.03);
      color: #dff0f8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .section-card {
      margin-top: 18px;
      position: relative;
      z-index: 1;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .section-head-copy {
      display: none;
      max-width: 620px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }

    .section-index {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--teal);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .score-shell {
      display: grid;
      grid-template-columns: 290px 1fr;
      gap: 18px;
      align-items: stretch;
      position: relative;
      z-index: 1;
    }

    .score-hero {
      background:
        linear-gradient(180deg, rgba(15, 40, 56, 0.98), rgba(7, 22, 31, 0.98));
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 26px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .score-hero::after {
      content: "";
      position: absolute;
      inset: auto -30px -60px auto;
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(103, 183, 255, 0.18), transparent 70%);
    }

    .score-number {
      font-size: 92px;
      line-height: 0.9;
      font-weight: 900;
      color: var(--teal);
      margin: 6px 0 10px;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
      position: relative;
      z-index: 1;
    }

    .score-tier {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(138, 217, 124, 0.14);
      color: var(--lime);
      font-size: 13px;
      font-weight: 700;
      border: 1px solid rgba(138, 217, 124, 0.22);
      position: relative;
      z-index: 1;
    }

    .player-meta {
      margin-top: 16px;
      display: grid;
      gap: 10px;
      position: relative;
      z-index: 1;
    }

    .player-meta div {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      align-items: start;
      gap: 18px;
      border-bottom: 1px solid rgba(145, 192, 215, 0.1);
      padding-bottom: 10px;
      font-size: 14px;
    }

    .player-meta span:first-child {
      color: var(--muted);
      font-weight: 500;
      line-height: 1.45;
    }

    .player-meta span:last-child {
      color: #eef8fc;
      font-weight: 700;
      line-height: 1.45;
      text-align: right;
    }

    .bar-chart {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 140px 1fr 52px;
      gap: 12px;
      align-items: center;
    }

    .bar-label {
      color: #dceaf1;
      font-size: 14px;
    }

    .bar-track {
      height: 12px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--teal), var(--sky));
    }

    .bar-value {
      color: var(--teal);
      font-size: 14px;
      font-weight: 700;
      text-align: right;
    }

    .quick-read-shell {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      gap: 18px;
      align-items: start;
    }

    .summary-lead {
      color: #eef7fb;
      font-size: 24px;
      line-height: 1.55;
      max-width: 760px;
    }

    .summary-stack {
      display: grid;
      gap: 12px;
    }

    .summary-badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .meter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .meter-card {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
      min-height: 138px;
      display: grid;
      gap: 10px;
      align-content: start;
    }

    .meter-top {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    .meter-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-weight: 800;
    }

    .meter-value {
      color: #eef8fc;
      font-size: 28px;
      line-height: 1.05;
      font-weight: 800;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
      overflow-wrap: anywhere;
    }

    .meter-track {
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }

    .meter-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--teal), var(--sky));
    }

    .meter-note {
      color: #d3e4ee;
      font-size: 13px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .compact-callout {
      margin-top: 0;
      font-size: 14px;
      line-height: 1.6;
    }

    .peer-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 10px;
    }

    .peer-card {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
    }

    .peer-name {
      color: #eef8fc;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .peer-meta {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }

    .peer-score {
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      color: var(--sky);
      margin-bottom: 8px;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    }

    .peer-note {
      color: #d3e4ee;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .trend-grid {
      display: grid;
      gap: 14px;
      margin-top: 10px;
    }

    .trend-detail-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .trend-card {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
    }

    .trend-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .trend-title {
      color: #eef8fc;
      font-size: 14px;
      font-weight: 700;
    }

    .trend-value {
      color: var(--teal);
      font-size: 14px;
      font-weight: 800;
    }

    .sparkline {
      display: flex;
      align-items: end;
      gap: 8px;
      height: 152px;
      padding: 18px 0 4px;
    }

    .spark-bar {
      flex: 1;
      border-radius: 10px 10px 4px 4px;
      background: linear-gradient(180deg, var(--sky), rgba(57, 198, 192, 0.75));
      min-width: 20px;
      position: relative;
    }

    .spark-bar::after {
      content: attr(data-label);
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      color: var(--muted);
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .trend-note {
      margin-top: 26px;
      color: #d3e4ee;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .radar-like {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .mini-score {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
      border-radius: 18px;
      padding: 16px;
    }

    .mini-score .name {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 8px;
      font-weight: 700;
    }

    .mini-score .num {
      font-size: 38px;
      line-height: 1;
      font-weight: 800;
      color: var(--sky);
      margin-bottom: 8px;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    }

    .mini-score .card-copy {
      overflow-wrap: anywhere;
    }

    .role-chip {
      display: inline-block;
      margin-top: 6px;
      padding: 5px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--teal);
      background: rgba(57, 198, 192, 0.12);
      border: 1px solid rgba(57, 198, 192, 0.16);
    }

    .pie-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 10px;
    }

    .donut {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 12px 10px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
    }

    .donut-ring {
      width: 116px;
      height: 116px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 26px;
      color: #f3fbff;
      position: relative;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    }

    .donut-ring::after {
      content: "";
      position: absolute;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #0d2230;
      box-shadow: inset 0 0 0 1px rgba(145, 192, 215, 0.12);
    }

    .donut-ring span {
      position: relative;
      z-index: 1;
    }

    .donut-label {
      text-align: center;
      font-size: 13px;
      color: var(--muted);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .match-evidence-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-top: 10px;
    }

    .evidence-card {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
      display: grid;
      gap: 8px;
      align-content: start;
    }

    .evidence-top {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 12px;
    }

    .evidence-title {
      color: #eef8fc;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.45;
    }

    .evidence-score {
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      color: var(--teal);
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
      white-space: nowrap;
    }

    .evidence-meta {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .evidence-note {
      color: #d3e4ee;
      font-size: 13px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .interpret-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 10px;
    }

    .interpret-card {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
      min-height: 148px;
    }

    .interpret-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .interpret-title {
      font-size: 14px;
      color: #eef8fc;
      font-weight: 700;
    }

    .interpret-badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .badge-good {
      color: var(--lime);
      background: rgba(138, 217, 124, 0.12);
      border: 1px solid rgba(138, 217, 124, 0.18);
    }

    .badge-watch {
      color: var(--amber);
      background: rgba(240, 179, 95, 0.12);
      border: 1px solid rgba(240, 179, 95, 0.18);
    }

    .badge-risk {
      color: var(--orange);
      background: rgba(243, 139, 99, 0.12);
      border: 1px solid rgba(243, 139, 99, 0.18);
    }

    .interpret-copy {
      color: #d3e4ee;
      font-size: 14px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }

    .context-score {
      margin: 6px 0 10px;
      color: #eefcff;
      font-size: 46px;
      line-height: 0.95;
      font-weight: 800;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
      text-shadow: 0 0 18px rgba(49, 199, 191, 0.14);
    }

    .tag-row {
      margin: 12px 0 10px;
    }

    .tag {
      display: inline-block;
      margin: 0 8px 8px 0;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--teal-soft);
      border: 1px solid rgba(57, 198, 192, 0.18);
      color: var(--teal);
      font-size: 13px;
      font-weight: 700;
    }

    .stats-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 14px;
    }

    .stats-box {
      border-radius: 20px;
      padding: 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.12);
    }

    .stats-box-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--teal);
      margin-bottom: 14px;
      font-weight: 700;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .stats-tile {
      border-radius: 16px;
      padding: 14px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(145, 192, 215, 0.10);
      min-height: 110px;
    }

    .stats-tile-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      margin-bottom: 8px;
      font-weight: 700;
    }

    .stats-tile-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--sky);
      line-height: 1.1;
      margin-bottom: 6px;
      font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    }

    .stats-tile-copy {
      color: #d5e7f1;
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .details-shell {
      display: grid;
      gap: 18px;
      margin-top: 18px;
      position: relative;
      z-index: 1;
    }

    .details-intro {
      display: grid;
      gap: 10px;
    }

    .footnote {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid rgba(145, 192, 215, 0.14);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
      position: relative;
      z-index: 1;
      display: grid;
      gap: 2px;
    }

    @media (max-width: 1100px) {
      .score-shell,
      .quick-read-shell,
      .stats-panel,
      .pie-row,
      .trend-detail-grid,
      .match-evidence-grid {
        grid-template-columns: 1fr;
      }

      .radar-like,
      .peer-grid,
      .interpret-grid,
      .stats-grid,
      .meter-grid,
      .title-mini-grid {
        grid-template-columns: 1fr;
      }

      .report-header-meta-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .bar-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .page-title {
        align-items: start;
        flex-direction: column;
      }

      .page-title-row {
        align-items: start;
      }

      .report-header-meta-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .report-header-meta-strip {
        grid-template-columns: 1fr;
      }
    }
  `;

  const lookupMetric = (items, matcher) => {
    return (items || []).find((item) => matcher(normalizeLabel(item?.label)));
  };

  const assessmentCard = (key, fallbackLabel) => {
    const payloadCard = payloadAssessment[key];
    if (payloadCard) {
      return {
        label: normalizeText(payloadCard.label) || fallbackLabel,
        score: toNumber(payloadCard.score, null),
        note: normalizeText(payloadCard.note),
        primary: payloadCard.primary === true,
      };
    }

    const item = lookupMetric(assessmentSnapshot, (label) => label.includes(key));
    return {
      label: normalizeText(item?.label) || fallbackLabel,
      score: toNumber(item?.value, null),
      note: normalizeText(item?.note),
      primary: item?.primary === true,
    };
  };

  const contextCard = (field, labelMatcher, fallbackLabel, fallbackNote) => {
    const payloadCard = payloadStrongOpposition[field] || payloadMatchSituation[field] || payloadDevelopment[field];
    if (payloadCard) {
      return {
        label: normalizeText(payloadCard.label) || fallbackLabel,
        score: toNumber(payloadCard.score, null),
        tone: normalizeText(payloadCard.tone),
        note: normalizeText(payloadCard.note) || fallbackNote,
      };
    }

    const item = lookupMetric(contextPerformance, labelMatcher);
    if (item) {
      return {
        label: normalizeText(item.label) || fallbackLabel,
        score: toNumber(item.value, null),
        tone: normalizeText(item.tone),
        note: normalizeText(item.note) || fallbackNote,
      };
    }

    return {
      label: fallbackLabel,
      score: null,
      tone: "watch",
      note: fallbackNote,
    };
  };

  const interpretationCard = (item) => ({
    label: normalizeText(item?.label) || "Selector Interpretation",
    badge: normalizeText(item?.badge) || "Watch",
    note: normalizeText(item?.note) || "No additional selector interpretation note is available.",
    tone: normalizeText(item?.tone) || toneFromLabel(item?.badge),
  });

  const noteBadgeClass = (tone) => {
    if (tone === "good") {
      return "badge-good";
    }
    if (tone === "risk") {
      return "badge-risk";
    }
    return "badge-watch";
  };

  const detailWithBreaks = (value, fallback) => {
    const text = normalizeText(value) || fallback;
    return escapeHtml(text).replace(/ • /g, "<br>");
  };

  const renderBarRow = (label, value) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${percentWidth(value)}%"></div></div>
      <div class="bar-value">${escapeHtml(displayNumber(value, 0, "0"))}</div>
    </div>
  `;

  const renderPeerCard = (item) => `
    <div class="peer-card${item.isSubject ? " subject" : ""}">
      <div class="peer-name">${escapeHtml(item.playerName || item.displayName || header.playerName || "Player")}</div>
      <div class="peer-meta">${escapeHtml([item.teamName, item.roleLabel].filter(Boolean).join(" • ") || "Peer comparison")}</div>
      <div class="peer-score">${escapeHtml(displayNumber(item.compositeScore, 0, "0"))}</div>
      <div class="peer-note">
        ${escapeHtml(normalizeText(item.note) || "Peer comparison note is not available for this player.")}
        ${item.percentileRank !== null && item.percentileRank !== undefined ? `<br>Percentile: ${escapeHtml(`${displayNumber(item.percentileRank, 0, "0")}th`)}` : ""}
      </div>
    </div>
  `;

  const renderTrendSparkline = (values) => {
    const safeValues = Array.isArray(values) && values.length ? values : [{ label: "N/A", value: 0 }];
    const maxValue = Math.max(...safeValues.map((item) => toNumber(item.value, 0)), 1);

    return `
      <div class="sparkline">
        ${safeValues
          .map((item, index) => {
            const label = normalizeText(item.label) || `Point ${index + 1}`;
            const height = Math.max(24, Math.round((toNumber(item.value, 0) / maxValue) * 100));
            return `<div class="spark-bar" style="height:${height}%" data-label="${escapeHtml(label)}"></div>`;
          })
          .join("")}
      </div>
    `;
  };

  const renderTrendNoteCard = (item, fallbackTitle) => `
    <div class="trend-card">
      <div class="trend-top">
        <div class="trend-title">${escapeHtml(normalizeText(item?.title) || fallbackTitle)}</div>
        <div class="trend-value">${escapeHtml(normalizeText(item?.status) || "Live")}</div>
      </div>
      ${renderTrendSparkline(item?.values)}
      <div class="trend-note">${escapeHtml(normalizeText(item?.note) || "No live trend note is available for this player.")}</div>
    </div>
  `;

  const renderAssessmentScore = (item) => `
    <div class="mini-score">
      <div class="name">${escapeHtml(item.label)}</div>
      <div class="num">${escapeHtml(displayNumber(item.score, 0, "0"))}</div>
      <div class="card-copy">${escapeHtml(item.note || "No assessment note is available.")}</div>
      ${item.primary ? '<div class="role-chip">Primary role</div>' : ""}
    </div>
  `;

  const renderDonutCard = (item, color) => {
    const value = toNumber(item?.value ?? item?.score, 0);
    const safeNote = normalizeText(item?.note) || "No additional selector readout note is available.";
    return `
      <div class="donut">
        <div class="donut-ring" style="background: conic-gradient(${color} 0 ${percentWidth(value)}%, rgba(255,255,255,0.08) ${percentWidth(value)}% 100%);">
          <span>${escapeHtml(displayNumber(value, 0, "0"))}</span>
        </div>
        <div class="donut-label">${escapeHtml(safeNote)}</div>
      </div>
    `;
  };

  const renderInterpretCard = (item, displayValue) => `
    <div class="interpret-card">
      <div class="interpret-top">
        <div class="interpret-title">${escapeHtml(item.label)}</div>
        <div class="interpret-badge ${noteBadgeClass(item.tone)}">${escapeHtml(displayValue)}</div>
      </div>
      <div class="interpret-copy">${escapeHtml(item.note)}</div>
    </div>
  `;

  const renderContextPerformanceCard = (item) => `
    <div class="interpret-card">
      <div class="interpret-top">
        <div class="interpret-title">${escapeHtml(item.label)}</div>
        <div class="interpret-badge ${noteBadgeClass(item.tone)}">${escapeHtml(
          item.tone === "good" ? "Strong" : item.tone === "risk" ? "Risk" : "Watch"
        )}</div>
      </div>
      <div class="context-score">${escapeHtml(displayNumber(item.score, 0, "—"))}</div>
      <div class="interpret-copy">${escapeHtml(item.note)}</div>
    </div>
  `;

  const renderStatTile = (label, stat, fallbackDetail) => `
    <div class="stats-tile">
      <div class="stats-tile-label">${escapeHtml(label)}</div>
      <div class="stats-tile-value">${escapeHtml(displayDataValue(stat?.value ?? 0))}</div>
      <div class="stats-tile-copy">${detailWithBreaks(stat?.detail, fallbackDetail)}</div>
    </div>
  `;

  const renderTitleMiniCard = (item) => `
    <div class="title-mini-card">
      <div class="title-mini-label">${escapeHtml(item.label)}</div>
      <div class="title-mini-value ${escapeHtml(item.valueClassName || "")}">${escapeHtml(normalizeText(item.value) || "—")}</div>
    </div>
  `;

  const renderMeterCard = (item) => {
    const safeValue = toNumber(item?.value, null);
    return `
      <div class="meter-card">
        <div class="meter-top">
          <div class="meter-label">${escapeHtml(normalizeText(item?.label) || "Signal")}</div>
          <div class="meter-value">${escapeHtml(displayNumber(safeValue, 0, "—"))}</div>
        </div>
        <div class="meter-track"><div class="meter-fill" style="width:${safeValue === null ? 0 : percentWidth(safeValue)}%"></div></div>
        <div class="meter-note">${escapeHtml(normalizeText(item?.note) || "Live selector context from the current report payload.")}</div>
      </div>
    `;
  };

  const renderEvidenceCard = (item) => `
    <div class="evidence-card">
      <div class="evidence-top">
        <div class="evidence-title">${escapeHtml(normalizeText(item.matchTitle) || "Match Evidence")}</div>
        <div class="evidence-score">${escapeHtml(displayNumber(item.score, 0, "—"))}</div>
      </div>
      <div class="evidence-meta">${escapeHtml(
        [normalizeText(item.matchDateLabel), normalizeText(header.divisionLabel)].filter(Boolean).join(" • ") || "Live match sample"
      )}</div>
      <div class="evidence-note">${escapeHtml(normalizeText(item.note) || "No live match evidence note is available.")}</div>
    </div>
  `;

  const battingAssessment = assessmentCard("batting", "Batting");
  const bowlingAssessment = assessmentCard("bowling", "Bowling");
  const fieldingAssessment = assessmentCard("fielding", "Fielding");
  const wicketkeepingAssessment = assessmentCard("wicketkeeping", "Wicketkeeping");

  const vsStrongTeams = contextCard(
    "vsStrongTeams",
    (label) => label === "vs strong teams",
    "Vs Strong Teams",
    "Opponent-adjusted profile is not available for this player sample."
  );
  const vsEliteOpponents = contextCard(
    "vsEliteOpponents",
    (label) => label === "vs elite opponents",
    "Vs Elite Opponents",
    "Elite-opponent context is not available for this player sample."
  );
  const div1Readiness = contextCard(
    "div1Readiness",
    (label) => label === "div 1 readiness",
    "Div 1 Split",
    "Div 1 readiness is not available for this player sample."
  );
  const matchImpact = contextCard(
    "matchImpact",
    (label) => label === "match impact",
    "Match Impact",
    "Match-impact context is not available for this player sample."
  );

  const consistency = payloadDevelopment.consistency || lookupMetric(selectorInterpretation, (label) => label === "consistency");
  const versatility = payloadDevelopment.versatility || lookupMetric(selectorInterpretation, (label) => label === "versatility");
  const recentForm = payloadDevelopment.recentForm || lookupMetric(selectorInterpretation, (label) => label === "recent form");

  const scoreBreakdown = [
    { label: "Bowling Efficiency", value: bowlingAssessment.score },
    { label: "Batting Efficiency", value: battingAssessment.score },
    { label: "Match Impact", value: matchImpact.score },
    { label: "Consistency", value: consistency?.score ?? consistency?.value },
    { label: "Versatility", value: versatility?.score ?? versatility?.value },
    { label: "Fielding", value: fieldingAssessment.score },
  ];

  const comparisonRows = (reportPayload.peerComparisonStrip || peerComparison || []).slice(0, 3);
  const trendRows = [
    reportPayload.trends?.strongOppositionPerformance,
    reportPayload.matchSituationMetrics?.pressureTrend,
    reportPayload.trends?.recentForm,
  ]
    .filter(Boolean)
    .slice(0, 3);
  const visualRows = [
    visualReadout[0] || {
      value: Math.max(toNumber(bowlingAssessment.score, 0), toNumber(battingAssessment.score, 0)),
      note: buildPrimarySkillNote(
        normalizeText(player.roleType) || "",
        battingAssessment.score || 0,
        bowlingAssessment.score || 0,
        fieldingAssessment.score || 0,
        wicketkeepingAssessment.score || 0
      ),
    },
    payloadStrongOpposition.vsStrongTeams || vsStrongTeams,
    payloadDevelopment.consistency || recentForm || consistency || {
      value: scores.compositeScore,
      note: "Consistency and recent form signal from the live report.",
    },
  ].slice(0, 3);
  const matchRows = matchEvidence.slice(0, 3);
  const interpretationRows = selectorInterpretation.slice(0, 6).map(interpretationCard);
  const currentSeriesStats = standardStats.currentSeries || {};
  const overallStats = standardStats.overall || {};
  const recommendationLabel = normalizeText(payloadRecommendation.label) || normalizeText(header.recommendation) || "Recommendation Pending";
  const recommendationTone = normalizeText(payloadRecommendation.tone) || toneFromLabel(recommendationLabel);
  const playerName = normalizeText(header.playerName) || normalizeText(payloadPlayerIdentity.playerName) || "Player";
  const summaryQuickRead =
    normalizeText(payloadRecommendation.quickRead) ||
    normalizeText(header.quickRead) ||
    "Current selector summary is loading from live analytics.";
  const finalTakeaway =
    normalizeText(report.selectorTakeaway) ||
    normalizeText(payloadRecommendation.selectorTakeaway) ||
    normalizeText(header.quickRead) ||
    "No selector takeaway is available for this player yet.";
  const percentileValue = Number.isFinite(toNumber(payloadComposite.percentileRank ?? header.percentileRank, null))
    ? `${displayNumber(payloadComposite.percentileRank ?? header.percentileRank, 0, "0")}th`
    : "—";
  const confidenceValue = [
    normalizeText(payloadRecommendation.confidenceLabel) || normalizeText(header.confidenceLabel),
    Number.isFinite(toNumber(payloadRecommendation.confidenceScore ?? header.confidenceScore, null))
      ? displayNumber(payloadRecommendation.confidenceScore ?? header.confidenceScore, 0, "0")
      : "",
  ]
    .filter(Boolean)
    .join(" • ");
  const quickReadMeters = [
    {
      label: "Composite",
      value: toNumber(payloadComposite.score ?? scores.compositeScore, null),
      note: "Overall selector score for the current player view.",
    },
    {
      label: "Percentile",
      value: toNumber(payloadComposite.percentileRank ?? header.percentileRank, null),
      note: "Role-scoped standing inside the current comparison cohort.",
    },
    {
      label: "Confidence",
      value: toNumber(payloadRecommendation.confidenceScore ?? header.confidenceScore, null),
      note: "Evidence depth supporting the recommendation right now.",
    },
    {
      label: normalizeText(vsStrongTeams.label) || "Strong Opposition",
      value: toNumber(vsStrongTeams.score, null),
      note: normalizeText(vsStrongTeams.note) || "How the profile holds up when opposition quality rises.",
    },
  ];
  const quickReadContextTags = [
    normalizeText(header.strengthSignal),
    normalizeText(header.comparisonPool),
    normalizeText(series.name),
  ].filter(Boolean);
  const reportHeaderMetaItems = [
    {
      label: "Team",
      value: normalizeText(header.teamName) || normalizeText(payloadPlayerIdentity.teamName) || "Unknown",
    },
    {
      label: "Primary Role",
      value: normalizeText(header.primaryRole) || "Player",
    },
    {
      label: "Comparison Pool",
      value: normalizeText(header.comparisonPool) || "Selector comparison pool",
    },
    {
      label: "Strength Signal",
      value: normalizeText(header.strengthSignal) || "Live analytics signal",
      performance: true,
    },
    {
      label: "Confidence",
      value: confidenceValue || normalizeText(header.confidenceLabel) || "Unknown",
      performance: true,
    },
    {
      label: "Percentile",
      value: percentileValue,
      performance: true,
    },
    {
      label: "Composite Selector Score",
      value: displayNumber(payloadComposite.score ?? scores.compositeScore, 0, "0"),
      performance: true,
    },
  ];
  const trendCards = trendRows.length
    ? trendRows
    : [
        {
          title: "Recent Form",
          status: normalizeText(recentForm?.badge) || "Live",
          values: [{ label: "Current", value: recentForm?.score ?? recentForm?.value ?? scores.compositeScore ?? 0 }],
          note: normalizeText(recentForm?.note) || "Live trend values are limited for this player sample.",
        },
      ];
  const phasePerformanceCountSource = {
    battingOverall: phasePerformance?.batting?.overall || [],
    battingPowerplay: phasePerformance?.batting?.powerplay || [],
    battingMiddle: phasePerformance?.batting?.middle || [],
    battingDeath: phasePerformance?.batting?.death || [],
    bowlingOverall: phasePerformance?.bowling?.overall || [],
    bowlingPowerplay: phasePerformance?.bowling?.powerplay || [],
    bowlingMiddle: phasePerformance?.bowling?.middle || [],
    bowlingDeath: phasePerformance?.bowling?.death || [],
  };
  const signalInputRows = [
    {
      label: "Composite Score",
      value: displayNumber(payloadComposite.score ?? scores.compositeScore, 0, "0"),
      copy: "Top-line selector score for the current player view.",
    },
    {
      label: "Role",
      value: normalizeText(header.primaryRole) || "Player",
      copy: normalizeText(header.strengthSignal) || "Primary strength signal.",
    },
    {
      label: "Percentile Rank",
      value: `${percentileValue} percentile`,
      copy: normalizeText(header.comparisonPool) || "Current comparison cohort.",
    },
    {
      label: "Confidence",
      value: normalizeText(header.confidenceLabel) || "Unknown",
      copy: Number.isFinite(toNumber(header.confidenceScore, null))
        ? `Live confidence score ${displayNumber(header.confidenceScore, 0, "0")}.`
        : "Confidence score is limited in this sample.",
    },
    {
      label: "Strong Opposition",
      value: displayNumber(vsStrongTeams.score, 0, "—"),
      copy: normalizeText(vsStrongTeams.note),
    },
    {
      label: "Match Impact",
      value: displayNumber(matchImpact.score, 0, "—"),
      copy: normalizeText(matchImpact.note),
    },
    {
      label: "Consistency",
      value: displayNumber(consistency?.score ?? consistency?.value, 0, "—"),
      copy: normalizeText(consistency?.note) || "Match-to-match stability in the current sample.",
    },
    {
      label: "Recent Form",
      value: displayNumber(recentForm?.score ?? recentForm?.value, 0, "—"),
      copy: normalizeText(recentForm?.note) || "Recent direction from the live analytics layer.",
    },
    {
      label: "Versatility",
      value: displayNumber(versatility?.score ?? versatility?.value, 0, "—"),
      copy: normalizeText(versatility?.note) || "Breadth across skills and roles.",
    },
    {
      label: "Div 1 Readiness",
      value: displayNumber(div1Readiness.score, 0, "—"),
      copy: normalizeText(div1Readiness.note),
    },
  ];
  const detailCards = [
    renderDetailsCard(
      "Trend Graphics",
      "Recent movement in strong-opposition value, pressure value, and current form.",
      trendCards,
      `<div class="trend-detail-grid">${trendCards
        .map((item, index) =>
          renderTrendNoteCard(item, index === 0 ? "Strong-Opposition Value" : index === 1 ? "Pressure Value" : "Recent Form")
        )
        .join("")}</div>`
    ),
    renderDetailsCard(
      "Role Matchups",
      "Who the player has actually faced most often in the current ball-by-ball sample.",
      { batting: battingVsBowlers, bowling: bowlingVsBatters },
      `
        <div class="split-2">
          <article class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Batting</span>
              <h3>Batting Vs Bowlers</h3>
            </div>
            ${renderTable(
              [
                { label: "Bowler", render: (row) => escapeHtml(row.opponentName) },
                { label: "Balls", className: "right", render: (row) => escapeHtml(displayInteger(row.balls, "0")) },
                { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
                { label: "SR", className: "right", render: (row) => escapeHtml(displayNumber(row.strikeRate, 1, "0")) },
                { label: "Dot %", className: "right", render: (row) => escapeHtml(displayNumber(row.dotPct, 1, "0")) },
                { label: "Dismissals", className: "right", render: (row) => escapeHtml(displayInteger(row.dismissals, "0")) },
              ],
              battingVsBowlers,
              { emptyMessage: "No batting matchup rows met the current threshold." }
            )}
          </article>
          <article class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Bowling</span>
              <h3>Bowling Vs Batters</h3>
            </div>
            ${renderTable(
              [
                { label: "Batter", render: (row) => escapeHtml(row.opponentName) },
                { label: "Balls", className: "right", render: (row) => escapeHtml(displayInteger(row.balls, "0")) },
                { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runsConceded, "0")) },
                { label: "Wickets", className: "right", render: (row) => escapeHtml(displayInteger(row.wickets, "0")) },
                { label: "Dot %", className: "right", render: (row) => escapeHtml(displayNumber(row.dotPct, 1, "0")) },
                { label: "Boundary %", className: "right", render: (row) => escapeHtml(displayNumber(row.boundaryPct, 1, "0")) },
              ],
              bowlingVsBatters,
              { emptyMessage: "No bowling matchup rows met the current threshold." }
            )}
          </article>
        </div>
      `,
      { open: false }
    ),
    renderDetailsCard(
      "Phase Performance",
      "Where the player is doing the work by phase and opponent type.",
      phasePerformanceCountSource,
      renderPhasePerformance(phasePerformance),
      { open: false }
    ),
    renderDetailsCard(
      "Over Evidence",
      "Best batting overs, strongest bowling overs, and expensive spells in one place.",
      overEvidence,
      renderOverEvidence(overEvidence),
      { open: false }
    ),
    renderDetailsCard(
      "Dismissal And Fielding Log",
      "How the player exits innings and how they show up in dismissals as a fielder.",
      dismissalFieldingLog,
      renderDismissalFielding(dismissalFieldingLog),
      { open: false }
    ),
    renderDetailsCard(
      "High-Leverage Commentary",
      "Top commentary events ranked by live impact weight and leverage.",
      commentaryEvidence.slice(0, 8),
      renderTable(
        [
          { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
          { label: "Ball", render: (row) => escapeHtml([row.ballLabel, row.phase].filter(Boolean).join(" • ") || "—") },
          { label: "Involvement", render: (row) => escapeHtml(normalizeText(row.involvementType) || "—") },
          {
            label: "Impact",
            className: "right",
            render: (row) => escapeHtml(
              [displayNumber(row.totalEventWeight, 1, "—"), displayNumber(row.leverageScore, 1, "—")].join(" / ")
            ),
          },
          { label: "Event", render: (row) => escapeHtml(truncate(row.commentaryText, 120) || "No commentary text available.") },
        ],
        commentaryEvidence.slice(0, 8),
        { emptyMessage: "No commentary evidence rows were returned." }
      ),
      { open: false }
    ),
    renderDetailsCard(
      "Signal Inputs",
      "Compact readout of the live selector inputs behind the executive summary.",
      signalInputRows,
      renderKeyValueTable(signalInputRows, {
        emptyMessage: "No live signal inputs are available for this player.",
      }),
      { open: false }
    ),
  ].join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(playerName)} Executive Report</title>
        <meta name="description" content="${escapeHtml(`Executive selector report for ${playerName}.`)}">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>${BASE_CSS}${REPORT_NOTE_CSS}</style>
      </head>
      <body>
        <section class="sheet report-sheet">
          <div class="page-separator">
            <div class="page-separator-line"></div>
            <div class="page-separator-badge">Executive Player Report</div>
            <div class="page-separator-line"></div>
          </div>

          <div class="page-title">
            <div class="page-title-main">
              <div class="eyebrow">Game-Changrs Selector Report</div>
              <div class="page-title-row">
                <h2>${escapeHtml(playerName)}</h2>
                <div class="recommendation-badge ${noteBadgeClass(recommendationTone)}">${escapeHtml(recommendationLabel)}</div>
              </div>
              <div class="takeaway-inline">${escapeHtml(finalTakeaway)}</div>
              ${renderReportHeaderMetaStrip(reportHeaderMetaItems)}
            </div>
          </div>

          <div class="section-banner"><span>Summary Section</span></div>

          <div class="section-card">
            <div class="section-head">
              <div>
                <h3>Composite Selector Score</h3>
              </div>
              <div class="section-head-copy">The first read is the score, role context, percentile, and confidence sitting behind the recommendation.</div>
            </div>
            <div class="score-shell">
              <div class="score-hero">
                <div class="card-label">Composite Selector Score</div>
                <div class="score-number">${escapeHtml(displayNumber(payloadComposite.score ?? scores.compositeScore, 0, "0"))}</div>
                <div class="score-tier">${escapeHtml(normalizeText(payloadComposite.tierLabel) || "Live Selector Profile")}</div>
              </div>

              <div class="card">
                <div class="card-label">Score Breakdown</div>
                <h3>Role-Scoped Score Mix</h3>
                <p class="section-copy">Short view of how the live model is weighting the selection case right now.</p>
                <div class="bar-chart">
                  ${scoreBreakdown.map((item) => renderBarRow(item.label, item.value)).join("")}
                </div>
              </div>
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Quick Read</h3>
              </div>
              <div class="section-head-copy">One short read for a coach or selector before they drop into tables.</div>
            </div>
            <div class="quick-read-shell">
              <div class="summary-stack">
                <p class="summary-lead">${escapeHtml(summaryQuickRead)}</p>
                <div class="summary-badge-row">
                  ${quickReadContextTags
                    .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
                    .join("")}
                </div>
              </div>
              <div class="meter-grid">
                ${quickReadMeters.map(renderMeterCard).join("")}
              </div>
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Assessment Snapshot</h3>
              </div>
              <div class="section-head-copy">Top skill buckets shown in a simple visual readout before deeper evidence.</div>
            </div>
            <div class="radar-like">
              ${[
                bowlingAssessment,
                battingAssessment,
                fieldingAssessment,
                wicketkeepingAssessment,
              ].map(renderAssessmentScore).join("")}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Visual Selector Readout</h3>
              </div>
              <div class="section-head-copy">Three fast-read dials covering primary skill, stronger-opposition grade, and stability.</div>
            </div>
            <div class="pie-row">
              ${visualRows
                .map((item, index) => renderDonutCard(item, ["var(--teal)", "var(--sky)", "var(--amber)"][index] || "var(--teal)"))
                .join("")}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Context Performance</h3>
              </div>
              <div class="section-head-copy">How the player profile holds up when the opposition, pressure, or division gets stronger.</div>
            </div>
            <div class="interpret-grid">
              ${[
                vsStrongTeams,
                vsEliteOpponents,
                div1Readiness,
                matchImpact,
              ]
                .map((item) => renderContextPerformanceCard(item))
                .join("")}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Match Evidence</h3>
              </div>
              <div class="section-head-copy">Highest-value matches from the live model, kept compact so the evidence is visible without a wall of text.</div>
            </div>
            <div class="match-evidence-grid">
              ${matchRows.length
                ? matchRows.map(renderEvidenceCard).join("")
                : renderEvidenceCard({
                    matchTitle: "Live Match Evidence",
                    matchDateLabel: "",
                    score: null,
                    note: "No standout live match evidence rows were returned for this player.",
                  })}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Selector Interpretation</h3>
              </div>
              <div class="section-head-copy">Short recommendation notes about how a selector should read the current profile.</div>
            </div>
            <div class="interpret-grid">
              ${interpretationRows.length
                ? interpretationRows.map((item) => renderInterpretCard(item, item.badge)).join("")
                : renderInterpretCard(
                    {
                      label: "Overall Selector View",
                      badge: normalizeText(recommendationLabel),
                      note: finalTakeaway,
                      tone: recommendationTone,
                    },
                    normalizeText(recommendationLabel)
                  )}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Peer Comparison</h3>
              </div>
              <div class="section-head-copy">Nearest selector peers in the current cohort, with the subject player highlighted.</div>
            </div>
            <div class="peer-grid">
              ${comparisonRows.length
                ? comparisonRows.map(renderPeerCard).join("")
                : renderPeerCard({
                    playerName,
                    teamName: normalizeText(header.teamName),
                    roleLabel: normalizeText(header.primaryRole),
                    compositeScore: scores.compositeScore,
                    note: finalTakeaway,
                    isSubject: true,
                  })}
            </div>
          </div>

          <div class="card section-card">
            <div class="section-head">
              <div>
                <h3>Series And Overall CricClubs Snapshot</h3>
              </div>
              <div class="section-head-copy">Current-series and overall profile numbers kept visible in the same visual system as the selector summary.</div>
            </div>
            <div class="stats-panel">
              <div class="stats-box">
                <div class="stats-box-title">Current Series</div>
                <div class="stats-grid">
                  ${renderStatTile("Batting", currentSeriesStats.batting, "No current-series batting stats returned.")}
                  ${renderStatTile("Bowling", currentSeriesStats.bowling, "No current-series bowling stats returned.")}
                  ${renderStatTile("Fielding", currentSeriesStats.fielding, "No current-series fielding stats returned.")}
                </div>
              </div>
              <div class="stats-box">
                <div class="stats-box-title">Overall CricClubs</div>
                <div class="stats-grid">
                  ${renderStatTile("Batting", overallStats.batting, "No overall batting stats returned.")}
                  ${renderStatTile("Bowling", overallStats.bowling, "No overall bowling stats returned.")}
                  ${renderStatTile("Fielding", overallStats.fielding, "No overall fielding stats returned.")}
                </div>
              </div>
            </div>
          </div>

          <div class="section-banner"><span>Details Section</span></div>

          <div class="card section-card details-intro">
            <div class="section-head">
              <div>
                <div class="section-index">Details</div>
                <h3>Drilldowns Behind The Summary</h3>
              </div>
              <div class="section-head-copy">All detailed matchups, phase splits, over evidence, dismissal logs, and commentary stay below in collapsible panels so the page remains visual first.</div>
            </div>
            <p class="section-copy">The summary above is meant for fast decisions. The panels below keep the evidence, match data, and exact tables available without turning page one into a text wall.</p>
          </div>

          <div class="details-shell">
            ${detailCards}
          </div>

          <div class="footnote">
            <div>Copyright &copy; 2026 game-changrs.com and Arth Arun.</div>
            <div>Concept, design direction, analytics framework, and associated code/materials are proprietary.</div>
            <div>All rights reserved.</div>
          </div>
        </section>
      </body>
    </html>
  `;
}

function renderAdminSetupPage(payload) {
  const series = payload.series || {};
  const sourceSetup = payload.sourceSetup || {};
  const divisions = Array.isArray(payload.divisions) ? payload.divisions : [];
  const reportProfile = payload.reportProfile || {};
  const validationAnchors = Array.isArray(payload.validationAnchors) ? payload.validationAnchors : [];
  const liveSummary = payload.liveSummary || {};

  return renderDocument({
    title: `${series.seriesName || "Series"} Setup`,
    description: "Admin setup surface for series source and target-division configuration.",
    seriesConfigKey: series.configKey,
    seriesName: series.seriesName,
    activeNav: "setup",
    pills: [
      { value: "Admin Setup" },
      { label: "Matches", value: displayInteger(liveSummary.totalMatches, "0") },
      { label: "Computed", value: displayInteger(liveSummary.computedMatches, "0"), tone: toInteger(liveSummary.warningMatches) ? "watch" : "good" },
    ],
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">Admin Setup</span>
            <h1>Series source, target scope, and report profile controls.</h1>
            <p class="hero-copy">
              This is the business-friendly setup surface for the live Supabase-backed series configuration.
              Use dry-run validation before applying writes.
            </p>
            ${renderMetaStrip([
              { label: "Source System", value: sourceSetup.sourceSystem },
              { label: "Target Age Group", value: sourceSetup.targetAgeGroup },
              { label: "Series URL", value: sourceSetup.seriesUrl },
              { label: "Active Report Profile", value: reportProfile.activeProfileName || reportProfile.activeProfileKey },
            ])}
          </div>
          <aside class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Live Summary</span>
              <h3>${escapeHtml(displayInteger(liveSummary.computedMatches, "0"))} computed matches are already sitting behind this setup.</h3>
            </div>
            <div class="callout">
              Authentication is not wired in this transfer bundle yet. Treat these routes as private internal tools for Game-Changrs operators only.
            </div>
          </aside>
        </div>
      </section>
    `,
    content: `
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Core Inputs</span>
            <h2>Basic Setup Controls</h2>
            <p class="section-copy">These are the top-level fields a normal operator should use most of the time.</p>
          </div>
          <div class="action-row">
            <a class="button ghost" href="${escapeHtml(buildApiPath(series.configKey, "/admin/setup"))}">Open JSON</a>
          </div>
        </div>
        <div class="form-grid">
          ${renderTextField("setup-name", "Name", sourceSetup.name, 6)}
          ${renderTextField("setup-series-url", "Series URL", sourceSetup.seriesUrl, 6)}
          ${renderTextField("setup-expected-league-name", "Expected League Name", sourceSetup.expectedLeagueName, 4)}
          ${renderTextField("setup-expected-series-name", "Expected Series Name", sourceSetup.expectedSeriesName, 4)}
          ${renderNumberField("setup-season-year", "Season Year", sourceSetup.seasonYear, 2)}
          ${renderTextField("setup-target-age-group", "Target Age Group", sourceSetup.targetAgeGroup, 3)}
          ${renderCheckboxField("setup-scrape-completed-only", "Scrape Completed Only", sourceSetup.scrapeCompletedOnly, 3)}
          ${renderCheckboxField("setup-include-ball-by-ball", "Include Ball By Ball", sourceSetup.includeBallByBall, 3)}
          ${renderCheckboxField("setup-include-player-profiles", "Include Player Profiles", sourceSetup.includePlayerProfiles, 3)}
          ${renderCheckboxField("setup-enable-auto-discovery", "Enable Auto Discovery", sourceSetup.enableAutoDiscovery, 3)}
          ${renderCheckboxField("setup-is-active", "Series Active", sourceSetup.isActive, 3)}
          ${renderSelectField(
            "setup-report-profile",
            "Report Profile",
            (reportProfile.options || []).map((item) => ({ value: item.profileKey, label: `${item.name}${item.description ? ` • ${item.description}` : ""}` })),
            reportProfile.activeProfileKey,
            6
          )}
          ${renderTextareaField("setup-notes", "Notes", sourceSetup.notes, 12)}
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Target Divisions</span>
            <h2>Competition Slice</h2>
            <p class="section-copy">Phase, division, strength ordering, and inclusion rules for the live Bay Area U15 scope.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table id="setup-divisions">
            <thead>
              <tr>
                <th>Source</th>
                <th>Target Label</th>
                <th>Phase</th>
                <th>Division</th>
                <th>Strength Rank</th>
                <th>Strength Tier</th>
                <th>Include</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${divisions
                .map(
                  (row) => `
                    <tr data-division-row>
                      <td>
                        <input type="hidden" data-field="id" value="${escapeHtml(String(row.id))}">
                        <div class="stack">
                          <strong>${escapeHtml(row.sourceLabel || row.targetLabel)}</strong>
                          <span class="inline-note">${escapeHtml(
                            [row.sourceDivisionId, (row.aliases || []).join(", ")].filter(Boolean).join(" • ")
                          )}</span>
                        </div>
                      </td>
                      <td><input class="table-input" data-field="targetLabel" value="${escapeHtml(row.targetLabel)}"></td>
                      <td><input class="table-input" data-field="phaseNo" type="number" value="${escapeHtml(String(row.phaseNo ?? ""))}"></td>
                      <td><input class="table-input" data-field="divisionNo" type="number" value="${escapeHtml(String(row.divisionNo ?? ""))}"></td>
                      <td><input class="table-input" data-field="strengthRank" type="number" value="${escapeHtml(String(row.strengthRank ?? ""))}"></td>
                      <td><input class="table-input" data-field="strengthTier" value="${escapeHtml(row.strengthTier)}"></td>
                      <td><input class="table-input" data-field="includeFlag" type="checkbox"${row.includeFlag ? " checked" : ""}></td>
                      <td><input class="table-input" data-field="notes" value="${escapeHtml(row.notes)}"></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="sheet">
        <div class="split-2">
          <div class="stack">
            <div class="section-header">
              <div class="stack">
                <span class="section-eyebrow">Validation Anchors</span>
                <h2>Known Reference Points</h2>
                <p class="section-copy">Read-only anchors from the database that help sanity-check downstream outputs.</p>
              </div>
            </div>
            ${renderTable(
              [
                { label: "Entity", render: (row) => escapeHtml([row.entityType, row.entityName].filter(Boolean).join(" • ")) },
                { label: "Expectation", render: (row) => escapeHtml(row.expectationText) },
                { label: "Priority", className: "right", render: (row) => escapeHtml(displayInteger(row.priorityRank, "0")) },
                { label: "State", render: (row) => renderBadge(row.isActive ? "Active" : "Inactive", row.isActive ? "good" : "risk") },
              ],
              validationAnchors,
              { emptyMessage: "No validation_anchor rows exist for this series yet." }
            )}
          </div>
          <div class="stack">
            <div class="section-header">
              <div class="stack">
                <span class="section-eyebrow">Write Controls</span>
                <h2>Dry Run Or Apply</h2>
                <p class="section-copy">Both actions hit the live Supabase-backed route. Dry run wraps the write in a rollback.</p>
              </div>
            </div>
            <div class="status-box">
              <pre id="setup-status">Ready for validation.</pre>
            </div>
            <div class="action-row">
              <button id="setup-dry-run" class="secondary" type="button">Validate Dry Run</button>
              <button id="setup-apply" type="button">Apply Setup Update</button>
            </div>
          </div>
        </div>
      </section>
    `,
    scripts: renderSetupScript(series.configKey),
  });
}

function renderAdminTuningPage(payload) {
  const series = payload.series || {};
  const scoringModel = payload.scoringModel || {};
  const pointsFormula = payload.pointsFormula || {};

  return renderDocument({
    title: `${series.seriesName || "Series"} Tuning`,
    description: "Admin tuning surface for live scoring-model settings.",
    seriesConfigKey: series.configKey,
    seriesName: series.seriesName,
    activeNav: "tuning",
    pills: [
      { value: "Admin Tuning" },
      { label: "Model", value: scoringModel.name || "No Active Model", tone: scoringModel.name ? "good" : "risk" },
      { label: "Version", value: scoringModel.versionLabel || "—" },
    ],
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">Advanced Tuning</span>
            <h1>Scoring rules, multipliers, and quality gates for the active model.</h1>
            <p class="hero-copy">
              This surface exposes the current live scoring-model inputs without requiring YAML edits.
              Use it when the selector logic needs fine-grained adjustment.
            </p>
            ${renderMetaStrip([
              { label: "Model Key", value: scoringModel.modelKey },
              { label: "Name", value: scoringModel.name },
              { label: "Version", value: scoringModel.versionLabel },
              { label: "Status", value: scoringModel.status },
            ])}
          </div>
          <aside class="side-panel stack">
            <div class="stack">
              <span class="card-topline">Tuning Posture</span>
              <h3>Edits are applied directly to the active scoring model assignment.</h3>
            </div>
            <div class="callout">
              This is an analyst-facing surface. Use the setup page for basic source and division inputs, then return here only for formula and threshold work.
            </div>
          </aside>
        </div>
      </section>
    `,
    content: `
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Points Formula</span>
            <h2>Base Competition Weights</h2>
            <p class="section-copy">Formula inputs behind the points-table strength component.</p>
          </div>
          <a class="button ghost" href="${escapeHtml(buildApiPath(series.configKey, "/admin/tuning"))}">Open JSON</a>
        </div>
        <div class="form-grid" id="points-formula">
          ${renderNumberField("pf-base-score", "Base Score", pointsFormula.baseScore, 2)}
          ${renderNumberField("pf-wins-weight", "Wins Weight", pointsFormula.winsWeight, 2)}
          ${renderNumberField("pf-nrr-weight", "NRR Weight", pointsFormula.nrrWeight, 2)}
          ${renderNumberField("pf-rank-weight", "Rank Weight", pointsFormula.rankWeight, 2)}
          ${renderNumberField("pf-min-weight", "Min Weight", pointsFormula.minWeight, 2)}
          ${renderNumberField("pf-max-weight", "Max Weight", pointsFormula.maxWeight, 2)}
        </div>
      </section>
      <section class="sheet">
        <div class="stack">
          ${renderEditableRuleTable("Team Strength Rules", "team-strength-rules", [
            { key: "divisionKey", label: "Division Key", type: "text" },
            { key: "divisionLabel", label: "Division Label", type: "text" },
            { key: "divisionPremium", label: "Division Premium", type: "number" },
            { key: "displayOrder", label: "Display Order", type: "number" },
          ], payload.teamStrengthRules || [])}
          ${renderEditableRuleTable("Player Tier Rules", "player-tier-rules", [
            { key: "discipline", label: "Discipline", type: "text" },
            { key: "tierName", label: "Tier Name", type: "text" },
            { key: "percentileMin", label: "Percentile Min", type: "number" },
            { key: "percentileMax", label: "Percentile Max", type: "number" },
            { key: "weightMultiplier", label: "Weight Multiplier", type: "number" },
            { key: "displayOrder", label: "Display Order", type: "number" },
          ], payload.playerTierRules || [])}
          ${renderEditableRuleTable("Phase Weights", "phase-weights", [
            { key: "roleType", label: "Role Type", type: "text" },
            { key: "phaseName", label: "Phase Name", type: "text" },
            { key: "weightMultiplier", label: "Weight Multiplier", type: "number" },
          ], payload.phaseWeights || [])}
          ${renderEditableRuleTable("Leverage Weights", "leverage-weights", [
            { key: "scenarioKey", label: "Scenario Key", type: "text" },
            { key: "scenarioLabel", label: "Scenario Label", type: "text" },
            { key: "weightMultiplier", label: "Weight Multiplier", type: "number" },
            { key: "enabled", label: "Enabled", type: "checkbox" },
            { key: "description", label: "Description", type: "text" },
          ], payload.leverageWeights || [])}
          ${renderEditableRuleTable("Composite Weights", "composite-weights", [
            { key: "primaryRole", label: "Primary Role", type: "text" },
            { key: "componentKey", label: "Component Key", type: "text" },
            { key: "componentLabel", label: "Component Label", type: "text" },
            { key: "weightValue", label: "Weight Value", type: "number" },
            { key: "displayOrder", label: "Display Order", type: "number" },
          ], payload.compositeWeights || [])}
          ${renderEditableRuleTable("Quality Gates", "quality-gates", [
            { key: "gateKey", label: "Gate Key", type: "text" },
            { key: "gateLabel", label: "Gate Label", type: "text" },
            { key: "numericValue", label: "Numeric Value", type: "number" },
            { key: "textValue", label: "Text Value", type: "text" },
            { key: "boolValue", label: "Bool Value", type: "checkbox" },
          ], payload.qualityGates || [])}
        </div>
      </section>
      <section class="sheet">
        <div class="split-2">
          <div class="status-box">
            <pre id="tuning-status">Ready for validation.</pre>
          </div>
          <div class="stack">
            <div class="action-row">
              <button id="tuning-dry-run" class="secondary" type="button">Validate Dry Run</button>
              <button id="tuning-apply" type="button">Apply Tuning Update</button>
            </div>
            <p class="field-note">The dry-run path validates inserts and updates inside a rollback transaction against the live database.</p>
          </div>
        </div>
      </section>
    `,
    scripts: renderTuningScript(series.configKey),
  });
}

function renderAdminMatchesPage(payload) {
  const series = payload.series || {};
  const filters = payload.filters || {};
  const summary = payload.summary || {};
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const recentRequests = Array.isArray(payload.recentRequests) ? payload.recentRequests : [];

  return renderDocument({
    title: `${series.seriesName || "Series"} Match Ops`,
    description: "Admin match-operations surface for refresh requests and selection overrides.",
    seriesConfigKey: series.configKey,
    seriesName: series.seriesName,
    activeNav: "matches",
    pills: [
      { value: "Match Operations" },
      { label: "Matches", value: displayInteger(summary.totalMatches, "0") },
      { label: "Overrides", value: displayInteger(summary.overriddenMatches, "0"), tone: toInteger(summary.overriddenMatches) ? "watch" : "good" },
      { label: "Warnings", value: displayInteger(summary.warningMatches, "0"), tone: toInteger(summary.warningMatches) ? "watch" : "good" },
    ],
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">Match Operations</span>
            <h1>Manual refresh requests and match-selection overrides for the live series.</h1>
            <p class="hero-copy">
              Use this surface for explicit exception handling only. Historical matches should be revisited through manual admin action,
              not by widening the normal refresh scope.
            </p>
            <form class="field" method="get" action="${escapeHtml(buildAdminPath(series.configKey, "/matches"))}">
              <span class="field-label">Filter Matches</span>
              <div class="action-row">
                <input type="search" name="query" value="${escapeHtml(filters.query || "")}" placeholder="Team, division, or source match id">
                <input type="number" name="limit" value="${escapeHtml(String(filters.limit || 25))}" min="1" max="100">
                <button type="submit">Refresh View</button>
                <a class="button ghost" href="${escapeHtml(buildApiPath(series.configKey, `/admin/matches?query=${encodeURIComponent(filters.query || "")}&limit=${encodeURIComponent(filters.limit || 25)}`))}">Open JSON</a>
              </div>
            </form>
          </div>
          <aside class="side-panel">
            <div class="metric-grid">
              ${renderMetricCard({ label: "Computed", value: summary.computedMatches || 0, digits: 0, copy: "Matches in computed analytics status.", tone: "good" })}
              ${renderMetricCard({ label: "Warnings", value: summary.warningMatches || 0, digits: 0, copy: "Matches with warn reconciliation state.", tone: toInteger(summary.warningMatches) ? "watch" : "good" })}
              ${renderMetricCard({ label: "Overrides", value: summary.overriddenMatches || 0, digits: 0, copy: "Active admin include/exclude decisions.", tone: toInteger(summary.overriddenMatches) ? "watch" : "neutral" })}
              ${renderMetricCard({ label: "View Limit", value: filters.limit || 25, digits: 0, copy: "Current match rows rendered in this page." })}
            </div>
          </aside>
        </div>
      </section>
    `,
    content: `
      <section class="sheet">
        <div class="split-2">
          <div class="stack">
            <div class="section-header">
              <div class="stack">
                <span class="section-eyebrow">Manual Refresh</span>
                <h2>Paste A Supported Match URL</h2>
                <p class="section-copy">Creates a targeted refresh request for a single CricClubs results page.</p>
              </div>
            </div>
            <div class="form-grid">
              ${renderTextField("refresh-match-url", "Match URL", "https://cricclubs.com/USACricketJunior/results/7487", 12)}
              ${renderTextField("refresh-requested-by", "Requested By", "phase8-api", 4)}
              ${renderTextareaField("refresh-reason", "Reason", "", 8)}
            </div>
            <div class="action-row">
              <button id="refresh-dry-run" class="secondary" type="button">Validate Dry Run</button>
              <button id="refresh-apply" type="button">Create Refresh Request</button>
            </div>
            <div class="status-box">
              <pre id="refresh-status">Ready for validation.</pre>
            </div>
          </div>
          <div class="stack">
            <div class="section-header">
              <div class="stack">
                <span class="section-eyebrow">Recent Requests</span>
                <h2>Latest Refresh Activity</h2>
                <p class="section-copy">Recent manual refresh request rows already recorded in the database.</p>
              </div>
            </div>
            ${renderTable(
              [
                { label: "Requested At", render: (row) => escapeHtml(formatDate(row.requestedAt) || "—") },
                { label: "Source Match", render: (row) => escapeHtml(row.requestSourceMatchId || row.linkedSourceMatchId || "—") },
                { label: "Requested By", render: (row) => escapeHtml(row.requestedBy || "—") },
                { label: "Status", render: (row) => renderBadge(row.status || "pending") },
                { label: "Reason", render: (row) => escapeHtml(truncate(row.reason || row.resolutionNote, 90) || "—") },
              ],
              recentRequests,
              { emptyMessage: "No manual_match_refresh_request rows have been created yet." }
            )}
          </div>
        </div>
      </section>
      <section class="sheet">
        <div class="section-header">
          <div class="stack">
            <span class="section-eyebrow">Selection Overrides</span>
            <h2>Per-Match Include Or Exclude Controls</h2>
            <p class="section-copy">Use force-include or force-exclude only when an explicit operator decision is required.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table id="match-ops-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Status</th>
                <th>Links</th>
                <th>Override</th>
              </tr>
            </thead>
            <tbody>
              ${
                matches.length
                  ? matches
                      .map(
                        (row) => `
                          <tr data-match-row data-match-id="${escapeHtml(String(row.matchId))}">
                            <td>
                              <div class="stack">
                                <strong>${escapeHtml(row.matchTitle)}</strong>
                                <span class="player-meta">${escapeHtml(
                                  [row.matchDateLabel, row.divisionLabel, row.sourceMatchId].filter(Boolean).join(" • ")
                                )}</span>
                                <span class="inline-note">${escapeHtml(row.resultText || "")}</span>
                              </div>
                            </td>
                            <td>
                              <div class="compact-stack">
                                ${renderBadge(row.analyticsStatus, toneFromLabel(row.analyticsStatus))}
                                ${renderBadge(row.parseStatus, toneFromLabel(row.parseStatus))}
                                ${renderBadge(row.reconciliationStatus, toneFromLabel(row.reconciliationStatus))}
                                ${row.needsRescrape || row.needsReparse || row.needsRecompute ? renderBadge("Pending Ops", "watch") : ""}
                              </div>
                            </td>
                            <td>
                              <div class="compact-stack">
                                ${row.matchPageUrl ? `<a href="${escapeHtml(row.matchPageUrl)}" target="_blank" rel="noreferrer">Match Page</a>` : ""}
                                ${row.scorecardUrl ? `<a href="${escapeHtml(row.scorecardUrl)}" target="_blank" rel="noreferrer">Scorecard</a>` : ""}
                                ${row.ballByBallUrl ? `<a href="${escapeHtml(row.ballByBallUrl)}" target="_blank" rel="noreferrer">Ball By Ball</a>` : ""}
                                <span class="inline-note">${escapeHtml(row.lastChangeReason || "No recent change reason")}</span>
                                ${row.lastErrorMessage ? `<span class="inline-note">${escapeHtml(truncate(row.lastErrorMessage, 120))}</span>` : ""}
                              </div>
                            </td>
                            <td>
                              <div class="stack">
                                <select class="table-select" data-field="override">
                                  ${["auto", "force_include", "force_exclude"]
                                    .map(
                                      (value) => `
                                        <option value="${escapeHtml(value)}"${value === row.adminSelectionOverride ? " selected" : ""}>
                                          ${escapeHtml(value)}
                                        </option>
                                      `
                                    )
                                    .join("")}
                                </select>
                                <input class="table-input" data-field="reason" value="${escapeHtml(row.adminOverrideReason || "")}" placeholder="Reason required for include/exclude">
                                <input class="table-input" data-field="requestedBy" value="phase8-api" placeholder="Requested by">
                                <div class="inline-actions">
                                  <button class="secondary" type="button" data-action="dry-run">Dry Run</button>
                                  <button type="button" data-action="apply">Apply</button>
                                </div>
                                <div class="inline-note" data-role="status">Current override: ${escapeHtml(row.adminSelectionOverride || "auto")}</div>
                              </div>
                            </td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="4" class="empty-cell">No matches were returned for the current filter.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `,
    scripts: renderMatchOpsScript(series.configKey),
  });
}

function renderErrorPage(input) {
  return renderDocument({
    title: input.title || "Error",
    description: input.message || "An error occurred.",
    seriesConfigKey: input.seriesConfigKey,
    seriesName: input.seriesName || "Cricket Analytics Control Surface",
    hero: `
      <section class="sheet">
        <div class="hero-grid">
          <div class="hero-panel">
            <span class="eyebrow">Request Error</span>
            <h1>${escapeHtml(input.title || "Unexpected failure")}</h1>
            <p class="hero-copy">${escapeHtml(input.message || "No additional error message was provided.")}</p>
          </div>
          <aside class="side-panel">
            <span class="card-topline">Status</span>
            <h3>${escapeHtml(String(input.statusCode || 500))}</h3>
            <p class="section-copy">Check the API route, live database state, or request parameters and try again.</p>
          </aside>
        </div>
      </section>
    `,
  });
}

function renderDetailsCard(title, note, data, body, options = {}) {
  const count = Array.isArray(data)
    ? data.length
    : data && typeof data === "object"
      ? Object.values(data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0)
      : 0;

  return `
    <details class="details-card"${options.open === false ? "" : " open"}>
      <summary>
        <div class="details-title">
          <span class="details-kicker">Executive Summary → Drilldown</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="details-meta">
          ${renderBadge(`${count} rows`, count ? "good" : "watch")}
        </div>
      </summary>
      <div class="details-body">${body}</div>
    </details>
  `;
}

function renderJsonDetailsCard(title, note, data, options = {}) {
  return renderDetailsCard(
    title,
    note,
    data,
    `
      <div class="status-box">
        <pre>${escapeHtml(JSON.stringify(data ?? {}, null, 2))}</pre>
      </div>
    `,
    options
  );
}

function renderPhasePerformance(phasePerformance) {
  return `
    <div class="phase-grid">
      ${renderPhasePerspective("Batting", phasePerformance.batting || {})}
      ${renderPhasePerspective("Bowling", phasePerformance.bowling || {})}
    </div>
  `;
}

function renderPhasePerspective(title, phases) {
  const order = [
    ["overall", "Overall"],
    ["powerplay", "Powerplay"],
    ["middle", "Middle"],
    ["death", "Death"],
  ];

  return `
    <article class="side-panel stack">
      <div class="stack">
        <span class="card-topline">${escapeHtml(title)}</span>
        <h3>${escapeHtml(title)} Phase Tables</h3>
      </div>
      ${order
        .map(([key, label]) => `
          <div class="stack">
            <strong>${escapeHtml(label)}</strong>
            ${renderTable(
              [
                { label: title === "Batting" ? "Bowler" : "Batter", render: (row) => escapeHtml(row.opponentName) },
                { label: "Balls", className: "right", render: (row) => escapeHtml(displayInteger(row.balls, "0")) },
                { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
                {
                  label: title === "Batting" ? "Strike Rate" : "Economy",
                  className: "right",
                  render: (row) => escapeHtml(displayNumber(title === "Batting" ? row.strikeRate : row.economy, 1, "0")),
                },
                { label: "Dot %", className: "right", render: (row) => escapeHtml(displayNumber(row.dotPct, 1, "0")) },
                { label: "Boundary %", className: "right", render: (row) => escapeHtml(displayNumber(row.boundaryPct, 1, "0")) },
                { label: "Dismissals", className: "right", render: (row) => escapeHtml(displayInteger(row.dismissals, "0")) },
              ],
              phases[key] || [],
              { emptyMessage: `No ${label.toLowerCase()} rows met the current threshold.` }
            )}
          </div>
        `)
        .join("")}
    </article>
  `;
}

function renderOverEvidence(overEvidence) {
  return `
    <div class="split-3">
      <article class="side-panel stack">
        <div class="stack">
          <span class="card-topline">Batting</span>
          <h3>Best Batting Overs</h3>
        </div>
        ${renderTable(
          [
            { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
            { label: "Over", className: "right", render: (row) => escapeHtml(displayInteger(row.overNo, "0")) },
            { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
            { label: "Boundaries", className: "right", render: (row) => escapeHtml(displayInteger(row.boundaries, "0")) },
          ],
          overEvidence.batting || [],
          { emptyMessage: "No batting over evidence rows were returned." }
        )}
      </article>
      <article class="side-panel stack">
        <div class="stack">
          <span class="card-topline">Bowling</span>
          <h3>Best Bowling Overs</h3>
        </div>
        ${renderTable(
          [
            { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
            { label: "Over", className: "right", render: (row) => escapeHtml(displayInteger(row.overNo, "0")) },
            { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
            { label: "Wickets", className: "right", render: (row) => escapeHtml(displayInteger(row.wickets, "0")) },
          ],
          overEvidence.bowlingBest || [],
          { emptyMessage: "No best-over bowling rows were returned." }
        )}
      </article>
      <article class="side-panel stack">
        <div class="stack">
          <span class="card-topline">Bowling</span>
          <h3>Expensive Overs</h3>
        </div>
        ${renderTable(
          [
            { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
            { label: "Over", className: "right", render: (row) => escapeHtml(displayInteger(row.overNo, "0")) },
            { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
            { label: "State", render: (row) => escapeHtml(row.stateText || "—") },
          ],
          overEvidence.bowlingExpensive || [],
          { emptyMessage: "No expensive-over bowling rows were returned." }
        )}
      </article>
    </div>
  `;
}

function renderDismissalFielding(data) {
  return `
    <div class="split-2">
      <article class="side-panel stack">
        <div class="stack">
          <span class="card-topline">Dismissals</span>
          <h3>Batting Exits</h3>
        </div>
        ${renderTable(
          [
            { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
            { label: "Runs", className: "right", render: (row) => escapeHtml(displayInteger(row.runs, "0")) },
            { label: "Balls", className: "right", render: (row) => escapeHtml(displayInteger(row.ballsFaced, "0")) },
            { label: "Dismissal", render: (row) => escapeHtml([row.dismissalType, row.dismissalText].filter(Boolean).join(" • ")) },
            { label: "Opposition", render: (row) => escapeHtml([row.dismissedBy, row.fielder].filter(Boolean).join(" • ")) },
          ],
          data.battingDismissals || [],
          { emptyMessage: "No batting dismissal rows were returned." }
        )}
      </article>
      <article class="side-panel stack">
        <div class="stack">
          <span class="card-topline">Fielding</span>
          <h3>Fielding Involvement</h3>
        </div>
        ${renderTable(
          [
            { label: "Match", render: (row) => escapeHtml([row.matchDateLabel, row.matchTitle].filter(Boolean).join(" • ")) },
            { label: "Dismissal", render: (row) => escapeHtml(row.dismissalType || "—") },
            { label: "Player Out", render: (row) => escapeHtml(row.playerOutName || "—") },
            { label: "Flags", render: (row) => escapeHtml([
              row.directRunOut ? "Direct RO" : "",
              row.indirectRunOut ? "Indirect RO" : "",
              row.wicketkeeperEvent ? "WK Event" : "",
            ].filter(Boolean).join(" • ") || "—") },
            { label: "Notes", render: (row) => escapeHtml([row.overBall, row.notes].filter(Boolean).join(" • ")) },
          ],
          data.fieldingInvolvement || [],
          { emptyMessage: "No fielding-event rows were returned." }
        )}
      </article>
    </div>
  `;
}

function truncate(value, maxLength) {
  const text = normalizeText(value);
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function renderTextField(id, label, value, span = 12) {
  return `
    <div class="field" style="grid-column: span ${span}">
      <span class="field-label">${escapeHtml(label)}</span>
      <input id="${escapeHtml(id)}" type="text" value="${escapeHtml(normalizeText(value))}">
    </div>
  `;
}

function renderNumberField(id, label, value, span = 12) {
  return `
    <div class="field" style="grid-column: span ${span}">
      <span class="field-label">${escapeHtml(label)}</span>
      <input id="${escapeHtml(id)}" type="number" step="any" value="${escapeHtml(value === null || value === undefined ? "" : String(value))}">
    </div>
  `;
}

function renderTextareaField(id, label, value, span = 12) {
  return `
    <div class="field" style="grid-column: span ${span}">
      <span class="field-label">${escapeHtml(label)}</span>
      <textarea id="${escapeHtml(id)}">${escapeHtml(normalizeText(value))}</textarea>
    </div>
  `;
}

function renderCheckboxField(id, label, checked, span = 12) {
  return `
    <div class="field" style="grid-column: span ${span}">
      <div class="checkbox-field">
        <span class="field-label">${escapeHtml(label)}</span>
        <input id="${escapeHtml(id)}" type="checkbox"${checked ? " checked" : ""}>
      </div>
    </div>
  `;
}

function renderSelectField(id, label, options, selectedValue, span = 12) {
  return `
    <div class="field" style="grid-column: span ${span}">
      <span class="field-label">${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}">
        ${options
          .map(
            (option) => `
              <option value="${escapeHtml(option.value)}"${normalizeText(option.value) === normalizeText(selectedValue) ? " selected" : ""}>
                ${escapeHtml(option.label)}
              </option>
            `
          )
          .join("")}
      </select>
    </div>
  `;
}

function renderEditableRuleTable(title, id, columns, rows) {
  return `
    <details class="details-card" open>
      <summary>
        <div class="details-title">
          <span class="details-kicker">Advanced Model Inputs</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="details-meta">${renderBadge(`${rows.length} rows`, rows.length ? "good" : "watch")}</div>
      </summary>
      <div class="details-body">
        <div class="table-wrap">
          <table id="${escapeHtml(id)}" data-rule-table>
            <thead>
              <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map(
                        (row) => `
                          <tr data-rule-row>
                            ${columns
                              .map((column) => renderRuleCell(row, column))
                              .join("")}
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="${columns.length}" class="empty-cell">No rows available.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </details>
  `;
}

function renderRuleCell(row, column) {
  const value = row[column.key];
  if (column.type === "checkbox") {
    return `
      <td>
        <input class="table-input" data-field="${escapeHtml(column.key)}" type="checkbox"${value ? " checked" : ""}>
      </td>
    `;
  }

  return `
    <td>
      <input
        class="table-input"
        data-field="${escapeHtml(column.key)}"
        type="${column.type === "number" ? "number" : "text"}"
        ${column.type === "number" ? 'step="any"' : ""}
        value="${escapeHtml(value === null || value === undefined ? "" : String(value))}"
      >
    </td>
  `;
}

function renderSetupScript(seriesConfigKey) {
  return `
    (() => {
      const endpoint = ${serializeForScript(buildApiPath(seriesConfigKey, "/admin/setup"))};
      const statusBox = document.getElementById("setup-status");
      const dryButton = document.getElementById("setup-dry-run");
      const applyButton = document.getElementById("setup-apply");

      function value(id) {
        return document.getElementById(id).value.trim();
      }

      function numberValue(id) {
        const raw = value(id);
        return raw === "" ? null : Number(raw);
      }

      function checked(id) {
        return document.getElementById(id).checked;
      }

      function collectDivisions() {
        return Array.from(document.querySelectorAll("[data-division-row]")).map((row) => ({
          id: Number(row.querySelector('[data-field="id"]').value),
          targetLabel: row.querySelector('[data-field="targetLabel"]').value.trim(),
          phaseNo: row.querySelector('[data-field="phaseNo"]').value === "" ? null : Number(row.querySelector('[data-field="phaseNo"]').value),
          divisionNo: row.querySelector('[data-field="divisionNo"]').value === "" ? null : Number(row.querySelector('[data-field="divisionNo"]').value),
          strengthRank: row.querySelector('[data-field="strengthRank"]').value === "" ? null : Number(row.querySelector('[data-field="strengthRank"]').value),
          strengthTier: row.querySelector('[data-field="strengthTier"]').value.trim(),
          includeFlag: row.querySelector('[data-field="includeFlag"]').checked,
          notes: row.querySelector('[data-field="notes"]').value.trim(),
        }));
      }

      async function submit(dryRun) {
        dryButton.disabled = true;
        applyButton.disabled = true;
        statusBox.textContent = dryRun ? "Running dry-run validation..." : "Applying live setup update...";

        const body = {
          reportProfileKey: value("setup-report-profile"),
          sourceSetup: {
            name: value("setup-name"),
            seriesUrl: value("setup-series-url"),
            expectedLeagueName: value("setup-expected-league-name"),
            expectedSeriesName: value("setup-expected-series-name"),
            seasonYear: numberValue("setup-season-year"),
            targetAgeGroup: value("setup-target-age-group"),
            scrapeCompletedOnly: checked("setup-scrape-completed-only"),
            includeBallByBall: checked("setup-include-ball-by-ball"),
            includePlayerProfiles: checked("setup-include-player-profiles"),
            enableAutoDiscovery: checked("setup-enable-auto-discovery"),
            isActive: checked("setup-is-active"),
            notes: value("setup-notes"),
          },
          divisions: collectDivisions(),
        };

        try {
          const response = await fetch(endpoint + "?dryRun=" + (dryRun ? "true" : "false"), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || payload.message || "Request failed.");
          }
          statusBox.textContent = JSON.stringify(payload, null, 2);
        } catch (error) {
          statusBox.textContent = error.message;
        } finally {
          dryButton.disabled = false;
          applyButton.disabled = false;
        }
      }

      dryButton.addEventListener("click", () => submit(true));
      applyButton.addEventListener("click", () => submit(false));
    })();
  `;
}

function renderTuningScript(seriesConfigKey) {
  return `
    (() => {
      const endpoint = ${serializeForScript(buildApiPath(seriesConfigKey, "/admin/tuning"))};
      const statusBox = document.getElementById("tuning-status");
      const dryButton = document.getElementById("tuning-dry-run");
      const applyButton = document.getElementById("tuning-apply");

      function readValue(input) {
        if (input.type === "checkbox") {
          return input.checked;
        }
        if (input.type === "number") {
          return input.value === "" ? null : Number(input.value);
        }
        return input.value.trim();
      }

      function collectRows(id) {
        const table = document.getElementById(id);
        if (!table) {
          return [];
        }

        return Array.from(table.querySelectorAll("[data-rule-row]")).map((row) => {
          const output = {};
          row.querySelectorAll("[data-field]").forEach((input) => {
            output[input.dataset.field] = readValue(input);
          });
          return output;
        });
      }

      async function submit(dryRun) {
        dryButton.disabled = true;
        applyButton.disabled = true;
        statusBox.textContent = dryRun ? "Running dry-run validation..." : "Applying live tuning update...";

        const body = {
          pointsFormula: {
            baseScore: document.getElementById("pf-base-score").value === "" ? null : Number(document.getElementById("pf-base-score").value),
            winsWeight: document.getElementById("pf-wins-weight").value === "" ? null : Number(document.getElementById("pf-wins-weight").value),
            nrrWeight: document.getElementById("pf-nrr-weight").value === "" ? null : Number(document.getElementById("pf-nrr-weight").value),
            rankWeight: document.getElementById("pf-rank-weight").value === "" ? null : Number(document.getElementById("pf-rank-weight").value),
            minWeight: document.getElementById("pf-min-weight").value === "" ? null : Number(document.getElementById("pf-min-weight").value),
            maxWeight: document.getElementById("pf-max-weight").value === "" ? null : Number(document.getElementById("pf-max-weight").value),
          },
          teamStrengthRules: collectRows("team-strength-rules"),
          playerTierRules: collectRows("player-tier-rules"),
          phaseWeights: collectRows("phase-weights"),
          leverageWeights: collectRows("leverage-weights"),
          compositeWeights: collectRows("composite-weights"),
          qualityGates: collectRows("quality-gates"),
        };

        try {
          const response = await fetch(endpoint + "?dryRun=" + (dryRun ? "true" : "false"), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || payload.message || "Request failed.");
          }
          statusBox.textContent = JSON.stringify(payload, null, 2);
        } catch (error) {
          statusBox.textContent = error.message;
        } finally {
          dryButton.disabled = false;
          applyButton.disabled = false;
        }
      }

      dryButton.addEventListener("click", () => submit(true));
      applyButton.addEventListener("click", () => submit(false));
    })();
  `;
}

function renderMatchOpsScript(seriesConfigKey) {
  return `
    (() => {
      const refreshEndpoint = ${serializeForScript(buildApiPath(seriesConfigKey, "/admin/matches/refresh-requests"))};
      const overrideBase = ${serializeForScript(buildApiPath(seriesConfigKey, "/admin/matches"))};
      const refreshStatus = document.getElementById("refresh-status");
      const refreshDryButton = document.getElementById("refresh-dry-run");
      const refreshApplyButton = document.getElementById("refresh-apply");

      async function submitRefresh(dryRun) {
        refreshDryButton.disabled = true;
        refreshApplyButton.disabled = true;
        refreshStatus.textContent = dryRun ? "Running dry-run validation..." : "Creating manual refresh request...";

        const body = {
          matchUrl: document.getElementById("refresh-match-url").value.trim(),
          requestedBy: document.getElementById("refresh-requested-by").value.trim(),
          reason: document.getElementById("refresh-reason").value.trim(),
        };

        try {
          const response = await fetch(refreshEndpoint + "?dryRun=" + (dryRun ? "true" : "false"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || payload.message || "Request failed.");
          }
          refreshStatus.textContent = JSON.stringify(payload, null, 2);
        } catch (error) {
          refreshStatus.textContent = error.message;
        } finally {
          refreshDryButton.disabled = false;
          refreshApplyButton.disabled = false;
        }
      }

      refreshDryButton.addEventListener("click", () => submitRefresh(true));
      refreshApplyButton.addEventListener("click", () => submitRefresh(false));

      document.getElementById("match-ops-table")?.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
          return;
        }

        const row = button.closest("[data-match-row]");
        const status = row.querySelector('[data-role="status"]');
        const matchId = row.dataset.matchId;
        const dryRun = button.dataset.action === "dry-run";
        const override = row.querySelector('[data-field="override"]').value;
        const reason = row.querySelector('[data-field="reason"]').value.trim();
        const requestedBy = row.querySelector('[data-field="requestedBy"]').value.trim();

        button.disabled = true;
        status.textContent = dryRun ? "Running dry-run validation..." : "Applying override...";

        try {
          const response = await fetch(overrideBase + "/" + encodeURIComponent(matchId) + "/selection-override?dryRun=" + (dryRun ? "true" : "false"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ override, reason, requestedBy }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || payload.message || "Request failed.");
          }
          status.textContent = JSON.stringify(payload);
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    })();
  `;
}

module.exports = {
  renderAdminMatchesPage,
  renderAdminSetupPage,
  renderAdminTuningPage,
  renderDashboardPage,
  renderErrorPage,
  renderPlayerReportPage,
  renderSeriesIndexPage,
};
