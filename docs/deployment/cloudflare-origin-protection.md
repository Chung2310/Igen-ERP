# Cloudflare Origin Protection Deployment

Use this checklist when deploying `nginx/cloudflare-realip.conf` and `nginx/igenerp.conf`. Do not run a sustained flood test against staging or production.

## Prepare and validate

1. Export the current host/provider firewall rules and back up the active Nginx files.
2. Compare `nginx/cloudflare-realip.conf` with Cloudflare's current official lists at `https://www.cloudflare.com/ips-v4/` and `https://www.cloudflare.com/ips-v6/`.
3. Confirm `/etc/nginx/nginx.conf` loads `/etc/nginx/conf.d/*.conf` before `/etc/nginx/sites-enabled/*`. Do not add a second include inside the site configuration.
4. Install the real-IP configuration at `/etc/nginx/conf.d/cloudflare-realip.conf` and the site configuration at its existing active path.
5. Run `sudo nginx -t`. Stop without reloading if it reports any error.

## Restrict the origin

1. Add allow rules for every current Cloudflare IPv4 and IPv6 range on TCP ports 80 and 443.
2. Add only the explicitly approved monitoring or administrative source ranges required by operations.
3. Confirm the allow rules work through the Cloudflare hostname before adding the public deny rule.
4. Deny all other public sources on ports 80 and 443. Keep SSH and provider recovery access outside these web rules.

This order avoids locking out legitimate traffic. The origin restriction is required because direct-origin traffic could otherwise bypass Cloudflare or spoof `CF-Connecting-IP`.

## Activate and smoke-test

1. Reload with `sudo systemctl reload nginx` only after `nginx -t` succeeds.
2. Verify `/api/v1/health`, a failed login, an authenticated API request, the frontend, and a Socket.IO connection.
3. Inspect `/var/log/nginx/igenerp_access.log`. Each entry must show the normalized visitor IP, `proxy=<Cloudflare peer IP>`, and a non-empty `cf_ray` for proxied traffic.
4. Send a small controlled series of sequential and concurrent failed login requests from one client. The application rate-limit remainder must use one monotonically decreasing counter, and excess traffic must return HTTP 429.
5. Repeat a small probe from a second external IP and confirm it has an independent counter.
6. Verify excessive Socket.IO handshakes receive `RATE_LIMITED` without affecting normal clients.

## Update Cloudflare ranges

Treat range updates as reviewed configuration changes. Fetch the official IPv4 and IPv6 lists, update only `set_real_ip_from` entries, review the diff, run the repository Nginx test and `nginx -t`, update firewall allow rules before removing obsolete ones, then reload Nginx.

## Roll back

1. Restore the previous Nginx include and site configuration.
2. Run `sudo nginx -t`; reload only when it succeeds.
3. Restore the exported firewall rule set through the provider recovery channel if required.
4. Verify health, login, frontend, and Socket.IO paths before closing the rollback.
