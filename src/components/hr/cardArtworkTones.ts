export const cardArtworkTones = [
  { from: "#16AFE8", to: "#52D0EA", ink: "#087CAD" },
  { from: "#5F99F2", to: "#79C4F6", ink: "#396DBB" },
  { from: "#F18A65", to: "#F6B46F", ink: "#BB6047" },
  { from: "#22BFAF", to: "#5AD5C4", ink: "#168D82" },
  { from: "#9B81EA", to: "#C28EE5", ink: "#7055B5" },
  { from: "#E979A6", to: "#F5A392", ink: "#B95280" },
] as const;

export function getCardArtworkTone(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return cardArtworkTones[hash % cardArtworkTones.length];
}
