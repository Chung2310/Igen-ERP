import { describe, expect, it } from 'vitest';
import { parseRegistrationDate } from './utils';

describe('parseRegistrationDate', () => {
  it('counts Vietnamese and ISO dates in the same month', () => {
    for (const value of ['20/10/2026', '2026-10-20', '2026-10-20T00:00:00.000Z']) {
      const date = parseRegistrationDate(value);
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(9);
    }
  });

  it('excludes missing and invalid dates from monthly totals', () => {
    for (const value of [undefined, '', '2026-02-30', '31/02/2026']) {
      expect(parseRegistrationDate(value)).toBeNull();
    }
  });
});
