const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

describe('sendSlackAlert', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it('POSTs message text to SLACK_WEBHOOK_URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { sendSlackAlert } = await import('../lib/slack');
    await sendSlackAlert('test message');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'test message' }),
      })
    );
  });

  it('does nothing when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    jest.resetModules();
    const { sendSlackAlert } = await import('../lib/slack');
    await sendSlackAlert('test message');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
