import { expect, it } from 'vitest';
import { validateField } from './policy';
import { emailAddressSchema } from '../validation/email-policy';
import { createStudentSchema, updateStudentSchema } from '../modules/student-management/validations/student.validation';
import { registerSchema } from '../modules/student-management/validations/auth.validation';
import { createPartnerSchema } from '../modules/student-management/validations/partner.validation';

it.each(['qa@example.test', 'qa@company.vn', 'qa+tag@erp.company', ' qa@example.test '])('accepts the same company-domain syntax in preview and business APIs: %s', email => {
  const expected = email.trim();
  expect(validateField({ key: 'email', label: 'Email', type: 'email' }, email)).toBe(expected);
  for (const schema of [emailAddressSchema, createStudentSchema.extract('email'), updateStudentSchema.extract('email'), registerSchema.extract('email'), createPartnerSchema.extract('email')]) {
    expect(schema.validate(email)).toMatchObject({ value: expected });
    expect(schema.validate(email).error).toBeUndefined();
  }
});
it.each(['qa@@company.vn', 'qa@company', 'qa@company..vn', 'qa name@company.vn', 'qa@-bad.vn', 'qa@company.vn\nBcc:other@example.test'])('rejects malformed email consistently before confirmation: %s', email => {
  expect(() => validateField({ key: 'email', label: 'Email', type: 'email' }, email)).toThrow();
  expect(createStudentSchema.extract('email').validate(email).error).toBeDefined();
});
