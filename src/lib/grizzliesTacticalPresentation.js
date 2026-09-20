export function tacticalActionBullets(action) {
  return String(action || "").trim().split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2);
}
