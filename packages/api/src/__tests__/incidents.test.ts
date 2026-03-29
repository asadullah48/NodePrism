import { resolveIncidentAction } from '../lib/incidents';

describe('resolveIncidentAction', () => {
  it('returns "open" when check fails and no open incident', () => {
    expect(resolveIncidentAction(false, null)).toBe('open');
  });

  it('returns "close" when check recovers and incident is open', () => {
    expect(resolveIncidentAction(true, 'incident-id')).toBe('close');
  });

  it('returns "noop" when check fails and incident already open', () => {
    expect(resolveIncidentAction(false, 'incident-id')).toBe('noop');
  });

  it('returns "noop" when check passes and no open incident', () => {
    expect(resolveIncidentAction(true, null)).toBe('noop');
  });
});
