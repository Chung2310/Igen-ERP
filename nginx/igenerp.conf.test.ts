import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteConfig = readFileSync(new URL("./igenerp.conf", import.meta.url), "utf8");
const cloudflareConfigUrl = new URL("./cloudflare-realip.conf", import.meta.url);

const cloudflareCidrs = [
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "108.162.192.0/18",
  "131.0.72.0/22",
  "141.101.64.0/18",
  "162.158.0.0/15",
  "172.64.0.0/13",
  "173.245.48.0/20",
  "188.114.96.0/20",
  "190.93.240.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

test("trusts CF-Connecting-IP only from every official Cloudflare network", () => {
  const realIpConfig = readFileSync(cloudflareConfigUrl, "utf8");
  for (const cidr of cloudflareCidrs) {
    assert.match(realIpConfig, new RegExp(`set_real_ip_from\\s+${cidr.replaceAll(".", "\\.")}\\s*;`));
  }
  assert.match(realIpConfig, /real_ip_header\s+CF-Connecting-IP\s*;/);
  assert.match(realIpConfig, /real_ip_recursive\s+on\s*;/);
  assert.doesNotMatch(
    siteConfig,
    /include\s+\/etc\/nginx\/conf\.d\/cloudflare-realip\.conf\s*;/,
    "conf.d is loaded by nginx.conf; the site must not load the real-IP file twice",
  );
});

test("overwrites client IP headers for every upstream location", () => {
  assert.doesNotMatch(siteConfig, /\$proxy_add_x_forwarded_for/);
  assert.equal(siteConfig.match(/proxy_set_header X-Real-IP \$remote_addr;/g)?.length, 6);
  assert.equal(siteConfig.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g)?.length, 6);
});

test("logs normalized IP, original proxy peer, and Cloudflare request ID", () => {
  assert.match(siteConfig, /log_format\s+igen_cloudflare[^;]*\$remote_addr[^;]*\$realip_remote_addr[^;]*\$http_cf_ray[^;]*;/s);
  assert.match(siteConfig, /access_log\s+\/var\/log\/nginx\/igenerp_access\.log\s+igen_cloudflare\s*;/);
});

test("uses separate wide CGNAT backstops for API, auth, and socket traffic", () => {
  assert.match(siteConfig, /zone=igen_api:20m rate=100r\/s/);
  assert.match(siteConfig, /zone=igen_auth:10m rate=10r\/s/);
  assert.match(siteConfig, /zone=igen_socket:20m rate=50r\/s/);
  assert.match(siteConfig, /location \^~ \/api\/v1\/auth\/[\s\S]*limit_req zone=igen_auth burst=30 nodelay;[\s\S]*limit_conn igen_per_ip 100/);
  assert.match(siteConfig, /location ~ \^\/api\/v1\/[\s\S]*limit_req zone=igen_expensive burst=10 nodelay;[\s\S]*limit_conn igen_per_ip 100/);
  assert.match(siteConfig, /location \/api\/[\s\S]*limit_conn igen_per_ip 300/);
  assert.match(siteConfig, /location \/socket\.io\/[\s\S]*limit_req zone=igen_socket burst=100 nodelay/);
  assert.match(siteConfig, /location \/socket\.io\/[\s\S]*limit_conn igen_per_ip 500/);
});
