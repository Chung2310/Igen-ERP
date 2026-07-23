import { useEffect, useState } from "react";

/** Trả về giá trị sau khi ngừng thay đổi trong `delay` ms — dùng cho ô tìm kiếm. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
