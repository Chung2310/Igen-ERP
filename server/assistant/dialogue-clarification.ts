/** A clarification has no selected action yet. Keep it distinct from an
 * executable draft: accepting its proposal only resumes preparation. */
export class UnresolvedAssistantClarification extends Error {
  constructor(readonly requestText:string, readonly question:string) {
    super('The clarification answer did not recover the pending request.');
  }
}
