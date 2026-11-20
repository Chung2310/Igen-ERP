export type EquipmentView = "devices" | "requests";

export function readEquipmentView(search: string): EquipmentView {
  return new URLSearchParams(search).get("view") === "requests" ? "requests" : "devices";
}

export function writeEquipmentView(
  view: EquipmentView,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  historyLike: Pick<History, "pushState"> = window.history,
) {
  const query = new URLSearchParams(locationLike.search);
  query.set("view", view);
  historyLike.pushState({}, "", `${locationLike.pathname}?${query.toString()}${locationLike.hash}`);
}
