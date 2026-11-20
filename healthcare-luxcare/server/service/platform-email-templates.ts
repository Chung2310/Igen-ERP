function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] || character;
  });
}

export function renderVerificationEmail(
  displayName: string | undefined,
  code: string,
  registration = false,
  companyName?: string,
): string {
  const greeting = displayName?.trim() ? escapeHtml(displayName.trim()) : "bạn";
  const safeCode = escapeHtml(code);
  const preheader = registration
    ? `Mã xác minh để hoàn tất đăng ký LuxCare của bạn là ${safeCode}.`
    : `Mã xác minh email LuxCare của bạn là ${safeCode}.`;
  const organization = companyName ? `Bạn đang tham gia tổ chức ${escapeHtml(companyName)}. ` : "";
  const instructions =
    organization +
    (registration
      ? "Nhập mã bên dưới trong ứng dụng LuxCare để xác minh địa chỉ email. Tài khoản chỉ được tạo từ lời mời tổ chức còn hiệu lực sau khi xác minh thành công. Nếu bạn đã yêu cầu gửi mã mới, chỉ mã trong email mới nhất còn hiệu lực."
      : "Nhập mã bên dưới trong ứng dụng LuxCare để hoàn tất xác minh địa chỉ email và kích hoạt tài khoản.");

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Xác minh email LuxCare</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f7f5;font-family:Arial,Helvetica,sans-serif;color:#14251f;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      ${preheader}
    </span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f7f5;width:100%;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0ebe6;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:#059669;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 36px 14px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" width="38" height="38" style="width:38px;height:38px;border-radius:12px;background:#047857;color:#ffffff;font-size:21px;font-weight:700;">L</td>
                    <td style="padding-left:11px;color:#12372c;font-size:21px;font-weight:700;letter-spacing:-.4px;">LuxCare</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 32px;">
                <p style="margin:0 0 10px;color:#047857;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">BẢO MẬT TÀI KHOẢN</p>
                <h1 style="margin:0;color:#14251f;font-size:29px;line-height:1.25;font-weight:700;letter-spacing:-.6px;">Xác minh email của bạn</h1>
                <p style="margin:22px 0 0;color:#33453e;font-size:15px;line-height:1.7;">Xin chào ${greeting},</p>
                <p style="margin:8px 0 0;color:#52645d;font-size:15px;line-height:1.7;">${instructions}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;width:100%;background:#f0fdf7;border:1px solid #b8ead4;border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:22px 12px 20px;">
                      <p style="margin:0 0 8px;color:#527064;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">MÃ XÁC MINH</p>
                      <p style="margin:0;color:#047857;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.25;font-weight:700;letter-spacing:9px;">${safeCode}</p>
                      <p style="margin:10px 0 0;color:#64756e;font-size:12px;line-height:1.5;">Mã có hiệu lực trong <strong style="color:#344a40;">15 phút</strong>.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;width:100%;background:#fffaf0;border-radius:12px;">
                  <tr>
                    <td valign="top" width="34" style="padding:13px 0 13px 14px;color:#b7791f;font-size:17px;line-height:1.4;">&#9888;</td>
                    <td style="padding:13px 14px 13px 5px;color:#735b32;font-size:12px;line-height:1.6;">Đừng chia sẻ mã này với bất kỳ ai. LuxCare sẽ không yêu cầu bạn cung cấp mã xác minh qua điện thoại hoặc tin nhắn.</td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;color:#64756e;font-size:13px;line-height:1.7;">Nếu bạn không yêu cầu tạo tài khoản, hãy bỏ qua email này. Tài khoản sẽ không được xác minh nếu chưa nhập mã.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px 22px;border-top:1px solid #edf2ef;color:#82918a;font-size:11px;line-height:1.6;">
                Email tự động từ LuxCare. Vui lòng không trả lời email này.<br>
                &copy; LuxCare
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
