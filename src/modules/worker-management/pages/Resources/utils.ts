export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getTypeColor = (type: string) => {
  const t = type.toLowerCase();
  if (t === "room" || t === "phòng học")
    return "bg-blue-500/10 text-blue-400 border border-blue-500/15";
  if (t === "vehicle" || t === "xe tập lái" || t === "phương tiện / xe")
    return "bg-amber-500/10 text-amber-400 border border-amber-500/15";
  if (t === "equipment" || t === "thiết bị" || t === "thiết bị dạy")
    return "bg-brand-primary/10 text-brand-primary border border-brand-primary/15";

  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15",
    "bg-violet-500/10 text-violet-400 border border-violet-500/15",
    "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/15",
    "bg-pink-500/10 text-pink-400 border border-pink-500/15",
    "bg-amber-500/10 text-amber-400 border border-amber-500/15",
    "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15",
  ];
  return colors[Math.abs(hash) % colors.length];
};
