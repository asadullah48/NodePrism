import net from 'net';
import { CheckResult } from './http';

const TCP_TIMEOUT_MS = 5_000;

export function checkTcp(target: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const lastColon = target.lastIndexOf(':');
    if (lastColon === -1) {
      return resolve({ success: false, latencyMs: 0 });
    }

    const host = target.slice(0, lastColon);
    const port = parseInt(target.slice(lastColon + 1), 10);

    if (!host || isNaN(port) || port < 1 || port > 65535) {
      return resolve({ success: false, latencyMs: 0 });
    }

    const start = Date.now();
    let settled = false;
    const socket = net.createConnection({ host, port });
    socket.unref(); // Don't keep the event loop alive

    const done = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ success: false, latencyMs: Date.now() - start });
    }, TCP_TIMEOUT_MS);

    socket.on('connect', () => {
      done({ success: true, latencyMs: Date.now() - start });
    });

    socket.on('error', () => {
      done({ success: false, latencyMs: Date.now() - start });
    });
  });
}
