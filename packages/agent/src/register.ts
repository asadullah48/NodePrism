import axios from 'axios';

export function buildRegistrationPayload(
  hostname: string,
  serverName?: string
): { name: string; host: string } {
  const trimmed = serverName?.trim();
  return {
    name: trimmed ? trimmed : hostname,
    host: hostname,
  };
}

export async function registerAgent(
  apiUrl: string,
  hostname: string,
  serverName?: string
): Promise<string> {
  const payload = buildRegistrationPayload(hostname, serverName);
  const response = await axios.post<{ id: string }>(`${apiUrl}/api/servers`, payload);
  return response.data.id;
}
