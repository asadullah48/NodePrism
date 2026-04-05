import { buildRegistrationPayload } from '../register';

describe('buildRegistrationPayload', () => {
  it('uses hostname as name when serverName is not provided', () => {
    expect(buildRegistrationPayload('my-machine')).toEqual({
      name: 'my-machine',
      host: 'my-machine',
    });
  });

  it('uses serverName as name when provided', () => {
    expect(buildRegistrationPayload('my-machine', 'Production Server')).toEqual({
      name: 'Production Server',
      host: 'my-machine',
    });
  });

  it('falls back to hostname when serverName is empty string', () => {
    expect(buildRegistrationPayload('my-machine', '')).toEqual({
      name: 'my-machine',
      host: 'my-machine',
    });
  });

  it('falls back to hostname when serverName is whitespace', () => {
    expect(buildRegistrationPayload('my-machine', '   ')).toEqual({
      name: 'my-machine',
      host: 'my-machine',
    });
  });
});
