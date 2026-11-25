/** Accept one complete JSON response, optionally wrapped for presentation.
 * Never extract a JSON substring from prose or combine multiple documents. */
export function parseAssistantModelJson(text: string): any {
  let source = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\s*```$/i.exec(source);
  if (fence) source = fence[1].trim();
  const tag = /^<(composite|types|json)>\s*([\s\S]*?)\s*<\/\1>$/i.exec(source);
  if (tag) source = tag[2].trim();
  return JSON.parse(source);
}
