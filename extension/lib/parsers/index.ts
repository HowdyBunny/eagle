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

/**
 * Collect diagnostic info for bug reports.
 * Returns a plain-text string safe to copy and send to developers.
 * No personal data — only structure/class names and selector hit/miss results.
 */
export function collectDiagnostics(): string {
  const lines: string[] = [];
  const platform = detectPlatform();

  lines.push('=== Eagle 诊断报告 ===');
  lines.push(`时间: ${new Date().toISOString()}`);
  lines.push(`URL: ${window.location.href.replace(/\/in\/[^/?#]+/, '/in/[REDACTED]')}`);
  lines.push(`平台: ${platform ?? '未知'}`);
  lines.push(`UA: ${navigator.userAgent}`);
  lines.push(`页面语言: ${document.documentElement.lang || document.querySelector('html')?.getAttribute('lang') || '未知'}`);
  lines.push('');

  if (platform === 'linkedin') {
    const isMobile = !!document.querySelector('section.basic-profile-section');
    lines.push(`LinkedIn 布局: ${isMobile ? 'mobile (mwlite)' : 'desktop'}`);
    lines.push('');

    if (isMobile) {
      lines.push('--- Mobile 选择器命中 ---');
      lines.push(`section.basic-profile-section: ${hit('section.basic-profile-section')}`);
      lines.push(`h1.heading-large: ${hit('h1.heading-large')}`);
      lines.push(`section.experience-container: ${hit('section.experience-container')}`);
      lines.push(`section.experience-container ol li (count): ${document.querySelectorAll('section.experience-container ol li').length}`);
      lines.push(`section.education-container: ${hit('section.education-container')}`);
      lines.push(`section.about-section: ${hit('section.about-section')}`);
    } else {
      lines.push('--- Desktop 选择器命中 ---');
      lines.push(`h1: ${hit('h1')} | text: "${document.querySelector('h1')?.textContent?.trim().slice(0, 3)}***"`);
      lines.push(`h2.pvs-header__title (count): ${document.querySelectorAll('h2.pvs-header__title').length}`);
      lines.push('');
      lines.push('section h2 标题列表:');
      document.querySelectorAll('h2.pvs-header__title').forEach((h2) => {
        lines.push(`  - "${h2.textContent?.trim()}"`);
      });
      lines.push('');
      lines.push(`div.text-body-medium.break-words: ${hit('div.text-body-medium.break-words')}`);
      lines.push(`span.text-body-small.inline.t-black--light.break-words: ${hit('span.text-body-small.inline.t-black--light.break-words')}`);
      lines.push(`section[data-view-name="profile-card"] (count): ${document.querySelectorAll('section[data-view-name="profile-card"]').length}`);
    }
  } else if (platform === 'liepin') {
    lines.push('--- 猎聘 选择器命中 ---');
    ['.name', '.resume-name', '.candidate-name', 'h1.geek-name', '.basic-info h1', 'h1'].forEach((s) => {
      lines.push(`${s}: ${hit(s)}`);
    });
    lines.push('');
    ['.work-list', '.work-experience', '[class*="work-exp"]'].forEach((s) => {
      lines.push(`${s}: ${hit(s)}`);
    });
  }

  lines.push('');
  lines.push('=== 报告结束 ===');
  return lines.join('\n');
}

function hit(selector: string): string {
  return document.querySelector(selector) ? '✓ 命中' : '✗ 未找到';
}
