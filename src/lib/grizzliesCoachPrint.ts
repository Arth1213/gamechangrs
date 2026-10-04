/** Native, selectable-text PDF output. No report data leaves the browser. */
export async function printGrizzliesCoachPlan(report: HTMLElement) {
  const doc = report.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error('Printing is unavailable in this window.');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        doc.fonts.ready,
        ...Array.from(report.querySelectorAll('img')).map(async image => {
          try { await image.decode(); }
          catch { throw new Error('A report logo could not load. Reload the page and try printing again.'); }
          if (!image.naturalWidth) throw new Error('A report logo could not load. Reload the page and try printing again.');
        }),
      ]),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('The print layout is still loading. Try again shortly.')), 8000);
      }),
    ]);
  } finally { clearTimeout(timeout); }

  const previousTitle = doc.title;
  try {
    doc.title = `GameChangrs - Grizzlies vs ${report.dataset.opponent} - Coaching Plan`;
    view.print();
  } finally { doc.title = previousTitle; }
}
