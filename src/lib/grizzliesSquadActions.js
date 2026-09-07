export const squadActionOrder = ["threat", "assessment"];

export const assessmentButtonClass =
  "border border-white/60 bg-slate-700 text-white shadow-sm shadow-black/35 transition-colors hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-white/70";

export function threatButtonClass(tone) {
  const base = "border border-white/70 text-white shadow-sm shadow-black/40 transition-colors focus-visible:ring-2 focus-visible:ring-white/80";
  if (tone === "red") return `${base} bg-red-500/25 hover:bg-red-500/35`;
  if (tone === "amber") return `${base} bg-amber-400/20 hover:bg-amber-400/30`;
  return `${base} bg-emerald-500/20 hover:bg-emerald-500/30`;
}
