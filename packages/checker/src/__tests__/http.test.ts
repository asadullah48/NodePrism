import { checkHttp } from '../checks/http';

describe('checkHttp', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(jest.fn());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns success=true and latencyMs>=0 for ok response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns success=false for non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns success=false and latencyMs=0 when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkHttp('https://example.com');
    expect(result.success).toBe(false);
    expect(result.latencyMs).toBe(0);
  });
});
