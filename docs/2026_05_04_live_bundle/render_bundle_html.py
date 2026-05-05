from __future__ import annotations

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parent

DOCS = [
    ("RESTORE_POINT_2026_05_04", "Restore Point"),
    ("ARCHITECTURE_2026_05_04", "Architecture"),
    ("CONFIG_REFERENCE_2026_05_04", "Config Reference"),
    ("LOCAL_OPS_START_2026_05_04", "Local Ops Start"),
]


def convert_markdown(md_text: str, title: str) -> str:
    lines = md_text.splitlines()
    html_parts: list[str] = []
    in_code = False
    in_list = False
    in_table = False
    table_lines: list[str] = []

    def close_list() -> None:
      nonlocal in_list
      if in_list:
        html_parts.append("</ul>")
        in_list = False

    def close_table() -> None:
      nonlocal in_table, table_lines
      if not in_table:
        return
      rows = [row.strip().strip("|").split("|") for row in table_lines]
      rows = [[cell.strip() for cell in row] for row in rows]
      if len(rows) >= 2:
        header = rows[0]
        body = rows[2:] if len(rows) > 2 else []
        html_parts.append("<table>")
        html_parts.append("<thead><tr>" + "".join(f"<th>{escape(cell)}</th>" for cell in header) + "</tr></thead>")
        html_parts.append("<tbody>")
        for row in body:
          html_parts.append("<tr>" + "".join(f"<td>{escape(cell)}</td>" for cell in row) + "</tr>")
        html_parts.append("</tbody></table>")
      table_lines = []
      in_table = False

    for raw in lines:
      line = raw.rstrip("\n")

      if line.startswith("```"):
        close_list()
        close_table()
        if in_code:
          html_parts.append("</code></pre>")
          in_code = False
        else:
          html_parts.append("<pre><code>")
          in_code = True
        continue

      if in_code:
        html_parts.append(escape(line))
        continue

      if line.strip().startswith("|") and line.strip().endswith("|"):
        close_list()
        in_table = True
        table_lines.append(line)
        continue
      else:
        close_table()

      stripped = line.strip()
      if not stripped:
        close_list()
        html_parts.append("")
        continue

      if stripped.startswith("# "):
        close_list()
        html_parts.append(f"<h1>{escape(stripped[2:])}</h1>")
      elif stripped.startswith("## "):
        close_list()
        html_parts.append(f"<h2>{escape(stripped[3:])}</h2>")
      elif stripped.startswith("### "):
        close_list()
        html_parts.append(f"<h3>{escape(stripped[4:])}</h3>")
      elif stripped.startswith("- "):
        if not in_list:
          html_parts.append("<ul>")
          in_list = True
        html_parts.append(f"<li>{escape(stripped[2:])}</li>")
      elif stripped[0:2].isdigit() and stripped[1:3] == ". ":
        close_list()
        html_parts.append(f"<p>{escape(stripped)}</p>")
      else:
        close_list()
        html_parts.append(f"<p>{escape(stripped)}</p>")

    close_list()
    close_table()

    body = "\n".join(part for part in html_parts if part != "")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      background: #f5f7fb;
      color: #172033;
      line-height: 1.55;
    }}
    main {{
      max-width: 980px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }}
    h1, h2, h3 {{ line-height: 1.2; }}
    h1 {{ font-size: 2rem; }}
    h2 {{ margin-top: 2rem; }}
    h3 {{ margin-top: 1.4rem; }}
    p, li {{ font-size: 1rem; }}
    ul {{ padding-left: 1.4rem; }}
    pre {{
      background: #0f172a;
      color: #e5eefc;
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 1.4rem;
      background: white;
      border-radius: 12px;
      overflow: hidden;
    }}
    th, td {{
      border: 1px solid #dbe4f0;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: #eaf0f8;
    }}
    .toplink {{
      display: inline-block;
      margin-bottom: 1rem;
      color: #0f5bd8;
      text-decoration: none;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <main>
    <a class="toplink" href="START_HERE_2026_05_04.html">Back to Start Here</a>
    {body}
  </main>
</body>
</html>
"""


def write_start_here() -> None:
    cards = []
    for filename, label in DOCS:
        cards.append(
            f"""
            <a class="card" href="{filename}.html">
              <span class="eyebrow">{label}</span>
              <strong>{filename}</strong>
            </a>
            """
        )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Game-Changrs Start Here - 2026-05-04</title>
  <style>
    body {{
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(circle at top left, #d8f0ff, transparent 30%),
        radial-gradient(circle at top right, #fff1d6, transparent 28%),
        #f5f7fb;
      color: #172033;
    }}
    main {{
      max-width: 980px;
      margin: 0 auto;
      padding: 56px 24px 80px;
    }}
    .hero {{
      background: rgba(255,255,255,0.78);
      border: 1px solid #dbe4f0;
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(23,32,51,0.08);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 28px;
    }}
    .card {{
      display: block;
      background: white;
      border: 1px solid #dbe4f0;
      border-radius: 18px;
      padding: 18px;
      color: inherit;
      text-decoration: none;
      box-shadow: 0 10px 24px rgba(23,32,51,0.06);
    }}
    .eyebrow {{
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f5bd8;
      margin-bottom: 8px;
    }}
    ul {{ padding-left: 1.3rem; }}
    code {{
      background: #eef3fb;
      border-radius: 6px;
      padding: 2px 6px;
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>Game-Changrs Start Here</h1>
      <p>Use this page first for the current live backup, restore, architecture, config, and local-ops run instructions.</p>
      <ul>
        <li>Live domain: <code>game-changrs.com</code></li>
        <li>Main app Supabase: <code>tpiegapsjeetvwsybjiu</code></li>
        <li>Analytics project: <code>azgebbtasywunltdhdby</code></li>
        <li>OneDrive backup root: <code>/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504</code></li>
      </ul>
      <div class="grid">
        {"".join(cards)}
      </div>
    </section>
  </main>
</body>
</html>
"""
    (ROOT / "START_HERE_2026_05_04.html").write_text(html)


def main() -> None:
    for filename, label in DOCS:
        md_path = ROOT / f"{filename}.md"
        html_path = ROOT / f"{filename}.html"
        html_path.write_text(convert_markdown(md_path.read_text(), label))
    write_start_here()


if __name__ == "__main__":
    main()
