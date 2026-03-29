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
    const socket = net.createConnection({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, latencyMs: TCP_TIMEOUT_MS });
    }, TCP_TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ success: true, latencyMs: Date.now() - start });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve({ success: false, latencyMs: Date.now() - start });
    });
  });
}
