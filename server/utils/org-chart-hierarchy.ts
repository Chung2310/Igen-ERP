export interface OrgChartRelationship {
  id: string;
  parentId?: string | null;
}

export function assertValidOrgChartParent(targetId: string, managerId: string, parentById: ReadonlyMap<string, string | undefined>) {
  const visited = new Set<string>();
  let currentId: string | undefined = managerId;
  while (currentId) {
    if (currentId === targetId) throw new Error("Không thể chuyển nhân sự xuống dưới quyền của chính mình hoặc cấp dưới.");
    if (visited.has(currentId)) throw new Error("Sơ đồ nhân sự hiện có vòng lặp; không thể cập nhật quan hệ quản lý.");
    visited.add(currentId);
    currentId = parentById.get(currentId);
  }
}

export function calculateOrgChartDescendantLevels(rootId: string, rootLevel: number, relationships: OrgChartRelationship[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (!relationship.parentId) continue;
    childrenByParent.set(relationship.parentId, [...(childrenByParent.get(relationship.parentId) || []), relationship.id]);
  }
  const levels = new Map<string, number>();
  const visited = new Set<string>([rootId]);
  let frontier = [{ id: rootId, level: rootLevel }];
  while (frontier.length) {
    const next: Array<{ id: string; level: number }> = [];
    for (const parent of frontier) {
      for (const childId of childrenByParent.get(parent.id) || []) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        const level = parent.level + 1;
        levels.set(childId, level);
        next.push({ id: childId, level });
      }
    }
    frontier = next;
  }
  return levels;
}
