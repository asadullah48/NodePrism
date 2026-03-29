import axios from 'axios';
import { UptimeCheckWithStatus } from '@nodeprism/shared';
import { checkHttp } from './checks/http';
import { checkTcp } from './checks/tcp';
import { reportResult } from './reporter';

export async function startRunner(apiUrl: string, secret: string): Promise<void> {
  console.log('Fetching checks from API...');

  let checks: UptimeCheckWithStatus[];
  try {
    const res = await axios.get<UptimeCheckWithStatus[]>(`${apiUrl}/api/checks`);
    checks = res.data;
  } catch (err) {
    console.error('Failed to fetch checks:', (err as Error).message);
    return;
  }

  if (checks.length === 0) {
    console.log('No checks configured. Add checks via POST /api/checks, then restart the checker.');
    return;
  }

  console.log(`Loaded ${checks.length} check(s). Starting intervals...`);

  const handles: NodeJS.Timeout[] = [];

  for (const check of checks) {
    const run = async () => {
      const result =
        check.type === 'http'
          ? await checkHttp(check.target)
          : await checkTcp(check.target);

      const icon = result.success ? '✓' : '✗';
      console.log(
        `[${check.name}] ${icon} ${result.success ? 'UP' : 'DOWN'} (${result.latencyMs}ms)`
      );

      await reportResult(apiUrl, check.id, result, secret);
    };

    // Run immediately, then on interval
    run().catch(console.error);
    handles.push(setInterval(run, check.interval * 1000));
  }

  const shutdown = () => {
    console.log('Checker shutting down...');
    handles.forEach(clearInterval);
    process.exit(0);
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
