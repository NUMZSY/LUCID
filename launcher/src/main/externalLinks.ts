export function validateExternalHttpsUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || /[\0\r\n]/.test(value)) {
    throw new Error('Promotion links must be valid HTTPS URLs.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Promotion links must be valid HTTPS URLs.');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('Only HTTPS promotion links can be opened.');
  }
  return url.toString();
}
