# Glass Reach Harness — private phone access

The harness has a responsive layout, but it runs on your Windows PC. A phone browser needs a separate private connection to that PC. The phone sends requests to the harness's own Codex sessions; it does not attach to an existing desktop chat.

This optional proxy configuration is supported by the server's origin and identity checks. It has not been validated end-to-end on a physical phone. Keep the host awake and the harness server running. Feed collection continues server-side while a browser is hidden; the browser may delay rendering.

## Optional Tailscale Serve setup

Use [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) for private tailnet access. Both devices need access to the same tailnet, with network policy allowing the intended connection. This setup expects Serve's Tailscale user identity header.

1. Follow Tailscale's HTTPS prerequisites, then on the Windows host run:

   ```powershell
   tailscale serve --bg http://127.0.0.1:47381
   ```

2. Note the HTTPS address. Stop the current harness server. In PowerShell, set the exact origin and the allowed Tailscale login:

   ```powershell
   $env:GLASS_REACH_MOBILE_ORIGIN = 'https://device-name.tailnet-name.ts.net'
   $env:GLASS_REACH_MOBILE_LOGIN = 'your-login@example.com'
   ```

3. In that same PowerShell window, navigate to the extracted project folder and run:

   ```powershell
   & '.\Open Glass Reach Harness.cmd'
   ```

4. Open the HTTPS address on the phone. The configured origin must have no path, use HTTPS, and end in `.ts.net`. The proxy's user login must match the configured value. Localhost access remains available.

Game credentials stay encrypted on the PC. The phone browser can cache observations and drafts, so it also holds private campaign data. Use Serve, not public Funnel, for this setup. For normal Windows setup, use the [quick-start](../QUICKSTART.md).
