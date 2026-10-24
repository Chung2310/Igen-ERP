let warnedAboutDockerHost = false;

export function redisHost(): string {
  const configured = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  if (configured.toLowerCase() !== "redis" || process.platform !== "win32" || process.env.npm_lifecycle_event !== "dev") {
    return configured;
  }
  if (!warnedAboutDockerHost) {
    warnedAboutDockerHost = true;
    console.warn("[Redis] Host 'redis' chỉ dùng trong Docker; npm run dev trên Windows sẽ kết nối 127.0.0.1:6379.");
  }
  return "127.0.0.1";
}
