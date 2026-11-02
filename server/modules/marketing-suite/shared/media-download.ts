const DOWNLOAD_DOMAINS = [
  "res.cloudinary.com", "cdn.pixabay.com", "www.soundhelix.com", "assets.mixkit.co", "freesound.org",
  "drive.google.com", "docs.google.com", "drive.usercontent.google.com", "lh3.googleusercontent.com",
];

export class MediaDownloadError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

function validateDownloadUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new MediaDownloadError("URL không hợp lệ.", 400); }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MediaDownloadError("Giao thức URL không được phép.", 400);
  }
  if (url.username || url.password || url.port || !DOWNLOAD_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    throw new MediaDownloadError("Domain không được phép proxy.", 403);
  }
  return url;
}

/** Validate every redirect before making the next request. */
export async function downloadMarketingMedia(value: string, fetcher: typeof fetch = fetch): Promise<Response> {
  let url = validateDownloadUrl(value);
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetcher(url.href, { redirect: "manual", signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || redirects === 5) throw new MediaDownloadError("Không thể theo chuyển hướng tải file.", 502);
    let nextUrl: URL;
    try { nextUrl = new URL(location, url); }
    catch { throw new MediaDownloadError("URL không hợp lệ.", 400); }
    url = validateDownloadUrl(nextUrl.href);
  }
  throw new MediaDownloadError("Không thể theo chuyển hướng tải file.", 502);
}
