// Stops the local forward proxy started by global-setup.
import { existsSync, readFileSync, rmSync } from "node:fs";

const PID_FILE = "/tmp/agentkey-proxy.pid";

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  rmSync(PID_FILE, { force: true });
  if (!pid) return;
  try {
    process.kill(pid, "SIGTERM");
    console.log(`global-teardown: stopped local proxy (pid ${pid})`);
  } catch {
    // Already gone.
  }
}
