import type { CandidateData } from '../types';
import { extractLinkedIn, waitForLinkedInProfile } from './linkedin';
import { extractLiepin } from './liepin';

export function extractCandidateData(): CandidateData {
  const hostname = window.location.hostname;

  if (hostname.includes('linkedin.com')) {
    return extractLinkedIn();
  }

  if (hostname.includes('liepin.com')) {
    return extractLiepin();
  }

  throw new Error('Unsupported platform: ' + hostname);
}

/**
 * Wait until the current profile page has fully loaded all sections into
 * the DOM before extraction is attempted.
 */
export function waitForProfile(): Promise<void> {
  const hostname = window.location.hostname;
  if (hostname.includes('linkedin.com')) {
    return waitForLinkedInProfile();
  }
  // Liepin renders synchronously; resolve immediately.
  return Promise.resolve();
}

export function detectPlatform(): 'linkedin' | 'liepin' | null {
  const hostname = window.location.hostname;
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('liepin.com')) return 'liepin';
  return null;
}
