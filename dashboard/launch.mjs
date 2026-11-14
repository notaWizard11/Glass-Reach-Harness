import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

export async function dashboardIsRunning(url, demo) {
  try {
    const response = await fetch(new URL('api/session', url), {
      headers: { 'X-Glass-Reach-Dashboard': '1' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.demo === demo && Array.isArray(data.profiles) && typeof data.masterPrompt === 'string';
  } catch { return false; }
}

async function launch() {
  const demo = process.argv.includes('--demo');
  const port = Number(process.env.PORT) || (demo ? 47382 : 47381);
  const url = `http://127.0.0.1:${port}/`;
  // Check before opening the store: a second process must not change active request state.
  if (await dashboardIsRunning(url, demo)) {
    console.log('Opening the dashboard that is already running.');
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true });
    return;
  }
  try {
    const app = await startServer({ demo, port });
    execFile('rundll32.exe', ['url.dll,FileProtocolHandler', app.url], { windowsHide: true });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { app.stop(); process.exit(); });
  } catch (error) {
    if (error.code === 'EADDRINUSE' && await dashboardIsRunning(url, demo)) {
      execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true });
      return;
    }
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is occupied by another service. The dashboard was not started.`
      : `Could not start the dashboard: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await launch();
