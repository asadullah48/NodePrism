import 'dotenv/config';
import { collectMetrics } from './collector';
import { sendMetrics } from './sender';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SERVER_ID = process.env.SERVER_ID ?? '';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '5000');

if (!SERVER_ID) {
  console.error('SERVER_ID is required in .env');
  process.exit(1);
}

console.log(`Agent started. Sending metrics every ${INTERVAL_MS}ms for server ${SERVER_ID}`);

async function run() {
  try {
    const metrics = await collectMetrics(SERVER_ID);
    await sendMetrics(API_URL, metrics);
    console.log(`Sent: CPU ${metrics.cpu}% | MEM ${metrics.memory}% | DISK ${metrics.disk}%`);
  } catch (err) {
    console.error('Failed to send metrics:', (err as Error).message);
  }
}

run();
setInterval(run, INTERVAL_MS);
