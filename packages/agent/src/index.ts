import 'dotenv/config';
import os from 'os';
import { collectMetrics } from './collector';
import { sendMetrics } from './sender';
import { registerAgent } from './register';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SERVER_NAME = process.env.SERVER_NAME;
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '5000');
const REGISTER_RETRIES = 5;
const REGISTER_RETRY_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerWithRetry(): Promise<string> {
  const hostname = os.hostname();
  for (let attempt = 1; attempt <= REGISTER_RETRIES; attempt++) {
    try {
      const id = await registerAgent(API_URL, hostname, SERVER_NAME);
      console.log(`Registered as "${SERVER_NAME ?? hostname}" (id: ${id})`);
      return id;
    } catch (err) {
      console.error(
        `Registration attempt ${attempt}/${REGISTER_RETRIES} failed:`,
        (err as Error).message
      );
      if (attempt < REGISTER_RETRIES) {
        await sleep(REGISTER_RETRY_DELAY_MS);
      }
    }
  }
  console.error('All registration attempts failed. Exiting.');
  process.exit(1);
}

async function main() {
  const serverId = await registerWithRetry();
  console.log(`Agent started. Sending metrics every ${INTERVAL_MS}ms`);

  async function run() {
    try {
      const metrics = await collectMetrics(serverId);
      await sendMetrics(API_URL, metrics);
      console.log(`Sent: CPU ${metrics.cpu}% | MEM ${metrics.memory}% | DISK ${metrics.disk}%`);
    } catch (err) {
      console.error('Failed to send metrics:', (err as Error).message);
    }
  }

  run();
  setInterval(run, INTERVAL_MS);
}

main();
