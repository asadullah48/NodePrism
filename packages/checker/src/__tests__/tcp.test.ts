import * as net from 'net';
import { checkTcp } from '../checks/tcp';

describe('checkTcp', () => {
  it('returns success=true when connecting to an open port', async () => {
    // Create a real TCP server on a random port
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as net.AddressInfo;

    const result = await checkTcp(`127.0.0.1:${port}`);
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns success=false when port is closed', async () => {
    const result = await checkTcp('127.0.0.1:19999');
    expect(result.success).toBe(false);
  });

  it('returns success=false for invalid target format', async () => {
    const result = await checkTcp('not-a-valid-target');
    expect(result.success).toBe(false);
  });
});
