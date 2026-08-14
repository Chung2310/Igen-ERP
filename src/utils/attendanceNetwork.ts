function expandIpv6(value: string): string[] | null {
  const address = value.trim().toLowerCase().replace(/\/\d+$/, "");
  if (!address.includes(":")) return null;
  const sides = address.split("::");
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides[1] ? sides[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sides.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part || "0"))) return null;
  return groups.map((part) => Number.parseInt(part || "0", 16).toString(16));
}

export function toAttendanceNetwork(value: string): string {
  const groups = expandIpv6(value);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : value.trim();
}
