import type { CandidateData } from '../types';

/**
 * Extract candidate data from a Liepin (猎聘) resume page.
 * Covers: /pmresume/* (headhunter view) and /resume/* paths.
 */
export function extractLiepin(): CandidateData {
  const raw: Record<string, unknown> = {
    extraction_timestamp: new Date().toISOString(),
    source_url: window.location.href,
    extraction_confidence: 'high',
  };

  const full_name = extractName();
  const current_title = extractTitle();
  const current_company = extractCompany();
  const location = extractLocation();
  const education = extractEducation();
  const { experience_summary, experiences } = extractExperience();

  raw.full_name = full_name;
  raw.current_title = current_title;
  raw.current_company = current_company;
  raw.location = location;
  raw.education = education;
  raw.experience_summary = experience_summary;
  raw.experiences = experiences;

  if (!full_name) raw.extraction_confidence = 'low';

  return {
    full_name: full_name || 'Unknown',
    current_title: current_title || undefined,
    current_company: current_company || undefined,
    location: location || undefined,
    education: education || undefined,
    experience_summary: experience_summary || undefined,
    liepin_url: window.location.href,
    source_platform: 'liepin',
    raw_structured_data: raw,
  };
}

function extractName(): string {
  const selectors = [
    '.name',
    '.resume-name',
    '.candidate-name',
    'h1.geek-name',
    '.basic-info h1',
    'h1',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length < 50) return text;
  }
  return '';
}

function extractTitle(): string {
  const selectors = [
    '.current-position',
    '.job-title',
    '.geek-title',
    '.resume-header .title',
    '.basic-info .title',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length < 200) return text;
  }
  return '';
}

function extractCompany(): string {
  const selectors = [
    '.current-company',
    '.company-name',
    '.geek-company',
    '.resume-header .company',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length < 100) return text;
  }
  return '';
}

function extractLocation(): string {
  const selectors = [
    '.location',
    '.city',
    '.geek-location',
    '.basic-info .location',
    '[class*="location"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length < 50 && !text.includes('http')) return text;
  }
  return '';
}

function extractEducation(): string {
  const lines: string[] = [];
  const selectors = [
    '.education-list',
    '.education-exp',
    '[class*="education"]',
  ];

  let section: Element | null = null;
  for (const sel of selectors) {
    section = document.querySelector(sel);
    if (section) break;
  }
  if (!section) return '';

  const items = section.querySelectorAll('li, .edu-item, [class*="edu-"]');
  items.forEach((item) => {
    const text = item.textContent?.trim().replace(/\s+/g, ' ');
    if (text && text.length < 200) lines.push(text);
  });

  return lines.join('; ');
}

function extractExperience(): { experience_summary: string; experiences: unknown[] } {
  const experiences: Array<{ title: string; company: string; duration: string; description: string }> = [];
  const selectors = [
    '.work-list',
    '.work-experience',
    '[class*="work-exp"]',
    '[class*="experience"]',
  ];

  let section: Element | null = null;
  for (const sel of selectors) {
    section = document.querySelector(sel);
    if (section) break;
  }
  if (!section) return { experience_summary: '', experiences: [] };

  const items = section.querySelectorAll('li, .work-item, [class*="work-item"]');
  items.forEach((item) => {
    const titleEl = item.querySelector('.job-title, .position, [class*="title"]');
    const companyEl = item.querySelector('.company, [class*="company"]');
    const durationEl = item.querySelector('.time, .duration, [class*="time"]');
    const descEl = item.querySelector('.desc, .description, p');

    const title = titleEl?.textContent?.trim() || '';
    const company = companyEl?.textContent?.trim() || '';
    const duration = durationEl?.textContent?.trim() || '';
    const description = descEl?.textContent?.trim().slice(0, 500) || '';

    if (title || company) {
      experiences.push({ title, company, duration, description });
    }
  });

  const summary = experiences
    .map((e) => {
      let s = e.title;
      if (e.company) s += ` at ${e.company}`;
      if (e.duration) s += ` (${e.duration})`;
      if (e.description) s += `: ${e.description}`;
      return s;
    })
    .join('\n\n');

  return { experience_summary: summary, experiences };
}
