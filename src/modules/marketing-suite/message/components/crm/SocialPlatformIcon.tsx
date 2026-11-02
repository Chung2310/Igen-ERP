type SocialPlatform = "facebook" | "zalo" | "tiktok";

const iconPath: Record<SocialPlatform, string> = {
  facebook: "/marketing-suite/facebook-logo.svg",
  zalo: "/marketing-suite/zalo-logo.svg",
  tiktok: "/marketing-suite/tiktok-logo.svg",
};

export function SocialPlatformIcon({ platform, className = "h-4 w-4" }: { platform: SocialPlatform; className?: string }) {
  return <img src={iconPath[platform]} alt="" aria-hidden="true" draggable={false} className={`shrink-0 object-contain ${className}`} />;
}
