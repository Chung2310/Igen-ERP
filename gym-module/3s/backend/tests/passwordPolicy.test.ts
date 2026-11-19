import { describe, expect, it } from 'vitest';
import { isValidPassword } from '../services/passwordPolicy.js';
import { isValidPassword as webPassword } from '../../frontend/src/services/passwordValidation.js';
import { createUserSchema, updateUserSchema, updateSelfProfileSchema } from '../validators/userValidator.js';
import { createCustomerAccountSchema } from '../validators/customerValidator.js';
import { loginSchema } from '../validators/authValidator.js';
const valid = ['abcdefgh','12345678','Mật khẩu mới 2026!','Password@2026',' password ','😀'.repeat(18)];
const invalid = ['123456','       ','a'.repeat(73),'😀'.repeat(19)];
describe('Password policy', () => {
  it.each(valid)('accepts supported password %s consistently for every account operation', password => {
    expect(isValidPassword(password)).toBe(true);
    expect(webPassword(password)).toBe(true);
    expect(createUserSchema.body!.validate({username:'pt-user',password,role:'PT',fullName:'Test PT',phone:'0901234567'}).error).toBeUndefined();
    expect(createCustomerAccountSchema.body!.validate({username:'customer',password}).error).toBeUndefined();
    expect(updateUserSchema.body!.validate({password}).error).toBeUndefined();
    const checked=updateSelfProfileSchema.body!.validate({currentPassword:'123456',password});
    expect(checked.error).toBeUndefined();
    expect(checked.value.password).toBe(password);
  });
  it.each(invalid)('rejects invalid new password %s', password => {
    expect(isValidPassword(password)).toBe(false);
    expect(webPassword(password)).toBe(false);
    expect(updateUserSchema.body!.validate({password}).error).toBeDefined();
    expect(updateSelfProfileSchema.body!.validate({password}).error).toBeDefined();
    expect(createUserSchema.body!.validate({username:'pt-user',password,role:'PT',fullName:'Test PT',phone:'0901234567'}).error).toBeDefined();
    expect(createCustomerAccountSchema.body!.validate({username:'customer',password}).error).toBeDefined();
  });
  it('keeps legacy login and optional unchanged passwords', () => {
    expect(loginSchema.body!.validate({username:'legacy',password:'123456'}).error).toBeUndefined();
    expect(updateSelfProfileSchema.body!.validate({password:''}).error).toBeUndefined();
    expect(updateUserSchema.body!.validate({password:null}).error).toBeUndefined();
  });
});
