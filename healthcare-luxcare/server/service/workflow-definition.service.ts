export interface WorkflowDefinitionStep {
  id: string;
}

export interface WorkflowDefinitionEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  outcomeKey: string;
  isDefault?: boolean;
}

export interface WorkflowDefinitionInput {
  steps?: WorkflowDefinitionStep[];
  edges?: WorkflowDefinitionEdge[];
}

export class WorkflowDefinitionError extends Error {
  statusCode = 400;
}

function fail(message: string): never {
  throw new WorkflowDefinitionError(message);
}

export function validateWorkflowDefinition(input: WorkflowDefinitionInput): void {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const stepIds = new Set<string>();

  for (const step of steps) {
    const id = String(step?.id || "").trim();
    if (!id) fail("Each workflow step must have an id.");
    if (stepIds.has(id)) fail(`Duplicate workflow step id: ${id}.`);
    stepIds.add(id);
  }

  const edgeIds = new Set<string>();
  const outcomesBySource = new Map<string, Set<string>>();
  const defaultCountBySource = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const id = String(edge?.id || "").trim();
    const source = String(edge?.source || "").trim();
    const target = String(edge?.target || "").trim();
    const label = String(edge?.label || "").trim();
    const outcomeKey = String(edge?.outcomeKey || "").trim();

    if (!id) fail("Each workflow branch must have an id.");
    if (edgeIds.has(id)) fail(`Duplicate workflow branch id: ${id}.`);
    edgeIds.add(id);
    if (!stepIds.has(source) || !stepIds.has(target)) fail("Workflow branch references a missing step.");
    if (source === target) fail("A workflow branch cannot target its own source step.");
    if (!label || !outcomeKey) fail("Each workflow branch needs a label and outcome key.");

    const outcomes = outcomesBySource.get(source) || new Set<string>();
    if (outcomes.has(outcomeKey)) fail(`Duplicate outcome "${outcomeKey}" for the same workflow step.`);
    outcomes.add(outcomeKey);
    outcomesBySource.set(source, outcomes);

    if (edge.isDefault) {
      const count = (defaultCountBySource.get(source) || 0) + 1;
      if (count > 1) fail("A workflow step can only have one default branch.");
      defaultCountBySource.set(source, count);
    }

    adjacency.set(source, [...(adjacency.get(source) || []), target]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stepId: string) => {
    if (visiting.has(stepId)) fail("Workflow branches cannot contain a cycle.");
    if (visited.has(stepId)) return;
    visiting.add(stepId);
    for (const target of adjacency.get(stepId) || []) visit(target);
    visiting.delete(stepId);
    visited.add(stepId);
  };

  for (const stepId of stepIds) visit(stepId);
}
