export const squadActionOrder = ["threat", "assessment"];

export const assessmentButtonClass =
  "border border-white/60 bg-slate-700 text-white shadow-sm shadow-black/35 transition-colors hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-white/70";

export function threatButtonClass(tone) {
  const base = "border shadow-sm shadow-black/40 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/80";
  if (tone === "red") return `${base} grizzlies-threat-red border-red-400/85 bg-red-500/25 text-red-200 hover:bg-red-500/45`;
  if (tone === "amber") return `${base} grizzlies-threat-amber border-amber-300/85 bg-amber-400/20 text-amber-200 hover:bg-amber-400/40`;
  return `${base} grizzlies-threat-green border-emerald-300/85 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40`;
}
