import { describe, expect, it } from 'vitest';
import { validateExternalHttpsUrl } from '../src/main/externalLinks.js';

describe('validateExternalHttpsUrl', () => {
  it('normalizes valid HTTPS URLs', () => {
    expect(validateExternalHttpsUrl('https://example.com/campaign?ref=lucid')).toBe('https://example.com/campaign?ref=lucid');
  });

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'not a URL',
    '',
    'https://example.com\nmalicious',
  ])('rejects unsafe or malformed values: %s', (value) => {
    expect(() => validateExternalHttpsUrl(value)).toThrow();
  });
});
