// Starts the local forward proxy (scripts/local-proxy.mjs) as a detached
// process before the tests run, so the sandboxed browser can reach HTTPS
// hosts through the VM's egress proxy. The PID is saved for teardown.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.AGENTKEY_PROXY_PORT || 18080);
const PID_FILE = "/tmp/agentkey-proxy.pid";

async function waitForPort(port: number, timeoutMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const sock = net.connect(port, "127.0.0.1");
      sock.once("connect", () => {
        sock.destroy();
        resolve(true);
      });
      sock.once("error", () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

export default async function globalSetup() {
  // Reuse a proxy that is already running (for example from an earlier run).
  if (await waitForPort(PORT, 1_000)) {
    console.log(`global-setup: local proxy already running on :${PORT}`);
    return;
  }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const script = path.join(dir, "..", "scripts", "local-proxy.mjs");
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  const up = await waitForPort(PORT);
  if (!up) throw new Error(`global-setup: local proxy did not start on :${PORT}`);
  console.log(`global-setup: local proxy started on :${PORT} (pid ${child.pid})`);
}
