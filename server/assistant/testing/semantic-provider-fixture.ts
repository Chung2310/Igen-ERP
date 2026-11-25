import { defaultWorkflow, operationById } from '../catalog';
import { assistantFunctionKey } from '../function-context';
import type { openrouterChat } from '../../service/openrouter.service';

/** Scripts one turn through the production routing stages, not just the final
 * interpretation. Intended only for deterministic conversation fixtures. */
export function semanticProviderFixture(fixture: Record<string, any>, routingIds?: string[]) {
  const ids: string[] = routingIds || (fixture.actionId ? [fixture.actionId] : fixture.businessDiscovery?.actionIds || []);
  const operations = ids.map(id => {
    const operation = operationById(id);
    if (!operation) throw new Error(`Unknown semantic fixture action: ${id}`);
    return operation;
  });
  return async (request: Parameters<typeof openrouterChat>[0]) => {
    const properties = (request.responseSchema as any)?.properties || {};
    let output: Record<string, any>;
    if (properties.modules) {
      const modules = [...new Set(operations.map(operation => operation.module))];
      if (!modules.length || modules.some(module => !properties.modules.items.enum.includes(module))) throw new Error('Fixture module is outside the routing catalog');
      output = { modules };
    } else if (properties.featureKeys) {
      const keys = [...new Set(operations.map(operation => assistantFunctionKey(defaultWorkflow(operation))))];
      const featureKeys = keys.filter(key => properties.featureKeys.items.enum.includes(key));
      if (!featureKeys.length && fixture.actionId) throw new Error('Fixture feature is outside the routing catalog');
      output = { featureKeys, ambiguous: !featureKeys.length, clarification: featureKeys.length ? '' : fixture.clarification || 'Bạn muốn xử lý thông tin nào?' };
    } else if (properties.actionIds) {
      const actionIds = ids.filter(id => properties.actionIds.items.enum.includes(id));
      if (!actionIds.length) throw new Error('Fixture action is outside the compact catalog');
      output = { actionIds };
    } else {
      const lastUser = [...request.messages].reverse().find(message => message.role === 'user');
      const text = typeof lastUser?.content === 'string' ? lastUser.content : '';
      const operation = operationById(fixture.actionId);
      const values = fixture.values || {};
      const mappedFields = Object.keys(values).flatMap(key => {
        const field = operation?.fields.find(candidate => candidate.key === key)
          || operation?.fields.find(candidate => candidate.apiKey === key || `${candidate.source}_${candidate.apiKey}` === key);
        return field ? [`values.${field.key}`] : [];
      });
      output = {
        actionIntent: operation?.assistantMetadata?.intent || 'unknown',
        requestCoverage: fixture.intentType === 'workflow'
          ? [{ evidence: text, requirement: operation?.title || fixture.actionId, mappedTo: ['action', ...mappedFields] }] : [],
        ...fixture,
      };
    }
    return { text: JSON.stringify(output) };
  };
}
