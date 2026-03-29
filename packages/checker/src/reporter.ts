import axios from 'axios';
import { CheckResult } from '@nodeprism/shared';

export async function reportResult(
  apiUrl: string,
  checkId: string,
  result: CheckResult,
  secret: string
): Promise<void> {
  try {
    await axios.post(
      `${apiUrl}/api/checks/${checkId}/result`,
      {
        success: result.success,
        latencyMs: result.latencyMs,
      },
      {
        headers: { Authorization: `Bearer ${secret}` },
      }
    );
  } catch (err) {
    console.error(
      `Failed to report result for check ${checkId}:`,
      (err as Error).message
    );
  }
}
