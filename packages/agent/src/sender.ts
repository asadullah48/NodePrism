import axios from 'axios';
import { MetricPayload } from '@nodeprism/shared';

export async function sendMetrics(apiUrl: string, payload: MetricPayload): Promise<void> {
  await axios.post(`${apiUrl}/api/metrics`, payload);
}
