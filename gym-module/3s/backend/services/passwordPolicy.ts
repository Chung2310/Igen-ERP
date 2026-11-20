export const PASSWORD_ERROR = 'Mật khẩu cần ít nhất 8 ký tự và không chỉ gồm khoảng trắng. Nếu mật khẩu quá dài, vui lòng rút ngắn và thử lại.';
export const PASSWORD_HINT = 'Tối thiểu 8 ký tự; có thể dùng chữ, số và ký tự đặc biệt';
export function isValidPassword(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).length < 8 || !value.trim()) return false;
  const bytes = Array.from(value).reduce((sum, char) => {
    const code = char.codePointAt(0)!;
    return sum + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
  return bytes <= 72;
}
