import { z } from 'zod';

export const httpsUrl = z.string().trim().min(1).refine(value => {
  if ([...value].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127) || /[\\?#]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}, 'Expected an absolute HTTPS URL without credentials, query or fragment').transform(value => new URL(value).href.replace(/\/$/, ''));
