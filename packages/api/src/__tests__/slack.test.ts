import * as slackModule from '../lib/slack';

describe('sendSlackAlert', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it('POSTs message text to SLACK_WEBHOOK_URL', async () => {
    await slackModule.sendSlackAlert('test message');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'test message' }),
      })
    );
  });

  it('does nothing when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    await slackModule.sendSlackAlert('test message');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
