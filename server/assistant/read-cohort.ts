import { createHash } from 'node:crypto';

// Per-read identity bindings stay outside JSON/public rows. A scope-checked
// digest in the session detects changed top-N membership on the next turn.
const identities = new WeakMap<object, string>();
export function bindReadRowIdentity(row: object, identity: string) {
  if(identity)identities.set(row, identity);
}
const canonical = (value: unknown): string => {
  if(value===undefined)return 'undefined';
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
};
export function readCohortDigest(rows: Record<string,unknown>[]): string {
  const members=rows.map(row=>createHash('sha256').update(identities.has(row)?'identity:'+identities.get(row):'row:'+canonical(row)).digest('hex')).sort();
  return createHash('sha256').update(JSON.stringify(members)).digest('hex');
}
