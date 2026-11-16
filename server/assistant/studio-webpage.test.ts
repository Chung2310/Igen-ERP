import { describe, expect, it } from "vitest";
import { AssistantError } from "./policy";
import { isPublicIpAddress, parseWebpageHtml, validateWebUrl } from "./studio-webpage";

describe("studio webpage knowledge extraction", () => {
  it("extracts page titles and readable text while excluding navigation and active content", () => {
    const page = parseWebpageHtml(`
      <html><head><title>Chính sách &amp; đổi trả</title><script>secretToken()</script></head>
      <body><nav>Điều hướng</nav><main><h1>Chính sách đổi trả</h1><p>Khách hàng có thể đổi hàng trong 30 ngày.</p><ul><li>Giữ hóa đơn</li></ul></main>
      <footer>Chân trang</footer><script>anotherSecret()</script></body></html>
    `, "example.com");

    expect(page.title).toBe("Chính sách & đổi trả");
    expect(page.text).toContain("Khách hàng có thể đổi hàng trong 30 ngày.");
    expect(page.text).toContain("Giữ hóa đơn");
    expect(page.text).not.toContain("Điều hướng");
    expect(page.text).not.toContain("secretToken");
    expect(page.text).not.toContain("Chân trang");
  });

  it("rejects internal addresses and unsafe URL schemes", () => {
    for (const address of ["127.0.0.1", "10.2.3.4", "192.168.1.10", "169.254.10.2", "::1", "fc00::1", "::ffff:192.168.1.2"]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
    expect(() => validateWebUrl("http://127.0.0.1/private")).toThrow(AssistantError);
    expect(() => validateWebUrl("file:///etc/passwd")).toThrow(AssistantError);
    expect(() => validateWebUrl("https://user:secret@example.com/path")).toThrow(AssistantError);
    expect(() => validateWebUrl("https://example.com:8443/path")).toThrow(AssistantError);
  });

  it("accepts public HTTP and HTTPS page URLs", () => {
    expect(validateWebUrl("https://example.com/policy").href).toBe("https://example.com/policy");
    expect(validateWebUrl("http://93.184.216.34/article").hostname).toBe("93.184.216.34");
  });
});
