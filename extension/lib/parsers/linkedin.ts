import type { CandidateData } from '../types';

// ============================================================================
// Wait for full page load  (works for both mobile and desktop)
// ============================================================================

/**
 * Resolves once the profile content is rendered in the DOM
 * (or after a 10 s safety timeout).
 *
 * Mobile:  waits for section.experience-container / section.education-container
 * Desktop: waits for h2.pvs-header__title (section headings) + h1 (name)
 */
export function waitForLinkedInProfile(): Promise<void> {
  return new Promise((resolve) => {
    const isReady = () => {
      // Mobile (mwlite) indicators
      if (
        document.querySelector('section.experience-container ol li') !== null ||
        document.querySelector('section.education-container ol li') !== null
      ) return true;
      // Desktop indicators
      if (
        document.querySelector('h2.pvs-header__title') !== null &&
        document.querySelector('h1') !== null
      ) return true;
      return false;
    };

    if (isReady()) { resolve(); return; }

    const observer = new MutationObserver(() => {
      if (isReady()) { observer.disconnect(); resolve(); }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(); }, 10_000);
  });
}

// ============================================================================
// Main extraction entry point
// ============================================================================

export function extractLinkedIn(): CandidateData {
  const raw: Record<string, unknown> = {
    extraction_timestamp: new Date().toISOString(),
    source_url: window.location.href,
  };

  // Detect mobile (mwlite) vs desktop by checking for mobile-specific section
  const isMobile = document.querySelector('section.basic-profile-section') !== null;

  if (isMobile) {
    return extractMobileLinkedIn(raw);
  } else {
    return extractDesktopLinkedIn(raw);
  }
}

// ============================================================================
// MOBILE parser  (original logic — LinkedIn mwlite DOM structure)
//
// Key sections:
//   section.basic-profile-section       — name / title / company / location
//   section.about-section               — about text
//   section.experience-container        — experience ol > li.profile-entity-lockup
//   section.education-container         — education  ol > li.entity-lockup
//
// Two experience entry types:
//   li.grouped        — company group header (> a.mb-1.5) + nested li.role-container roles
//   li (no grouped)   — single position, inside li.sub-group > a
// ============================================================================

function extractMobileLinkedIn(raw: Record<string, unknown>): CandidateData {
  const intro = extractMobileIntro();
  const about = extractMobileAbout();
  const { experiences, years_experience, experience_summary } = extractMobileExperience();
  const { educationList, education } = extractMobileEducation();

  raw.full_name = intro.full_name;
  raw.current_title = intro.current_title;
  raw.current_company = intro.current_company;
  raw.location = intro.location;
  raw.about = about;
  raw.experiences = experiences;
  raw.education_list = educationList;
  raw.years_experience_calculated = years_experience;

  return {
    full_name: intro.full_name || 'Unknown',
    current_title: intro.current_title || undefined,
    current_company: intro.current_company || undefined,
    location: intro.location || undefined,
    years_experience: years_experience || undefined,
    education: education || undefined,
    experience_summary: experience_summary || undefined,
    linkedin_url: window.location.href,
    source_platform: 'linkedin',
    raw_structured_data: raw,
  };
}

// --- Mobile: Basic info ---

interface IntroData {
  full_name: string;
  current_title: string;
  current_company: string;
  location: string;
}

function extractMobileIntro(): IntroData {
  const section = document.querySelector('section.basic-profile-section');

  const full_name = section?.querySelector('h1.heading-large')?.textContent?.trim() ?? '';

  const titleEl = section?.querySelector<HTMLElement>(
    'div.body-small.text-color-text:not(.text-color-text-low-emphasis)'
  );
  const current_title = titleEl?.querySelector('span')?.textContent?.trim() ?? '';

  const current_company =
    section?.querySelector('span.member-current-company')?.textContent?.trim() ?? '';

  let location = '';
  const lowDivs = section?.querySelectorAll('div.body-small.text-color-text-low-emphasis') ?? [];
  for (const div of lowDivs) {
    if (div.querySelector('.member-current-company')) continue;
    for (const node of div.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim();
        if (t) { location = t; break; }
      }
    }
    if (location) break;
  }

  return { full_name, current_title, current_company, location };
}

// --- Mobile: About ---

function extractMobileAbout(): string {
  return (
    document
      .querySelector('section.about-section div.description')
      ?.textContent?.trim() ?? ''
  );
}

// --- Mobile: Experience ---

interface MobileExperienceEntry {
  title: string;
  company: string;
  start: string;
  end: string;
  duration: string;
  location: string;
  description: string;
  durationYears: number;
}

function extractMobileExperience(): {
  experiences: MobileExperienceEntry[];
  years_experience: number;
  experience_summary: string;
} {
  const section = document.querySelector('section.experience-container');
  if (!section) return { experiences: [], years_experience: 0, experience_summary: '' };

  const experiences: MobileExperienceEntry[] = [];

  for (const li of section.querySelectorAll<HTMLElement>('ol > li.profile-entity-lockup')) {
    if (!li.classList.contains('visible-entity')) continue;

    if (li.classList.contains('grouped')) {
      const headerA = li.querySelector<HTMLElement>(':scope > a');
      const company =
        headerA
          ?.querySelector('.list-item-heading span, .body-medium-bold span')
          ?.textContent?.trim() ?? '';

      for (const roleEl of li.querySelectorAll<HTMLElement>(
        'div.entity-lockup-border li.role-container'
      )) {
        const entry = extractMobileGroupedRole(roleEl, company);
        if (entry.title) experiences.push(entry);
      }
    } else {
      const subGroup = li.querySelector<HTMLElement>('li.sub-group');
      if (subGroup) {
        const entry = extractMobileSingleRole(subGroup);
        if (entry.title) experiences.push(entry);
      }
    }
  }

  return buildExperienceSummary(experiences);
}

function extractMobileGroupedRole(el: HTMLElement, company: string): MobileExperienceEntry {
  const title = el.querySelector('.body-small-bold span')?.textContent?.trim() ?? '';
  const dateContainer = el.querySelector<HTMLElement>('div.body-small.text-color-text');
  const { start, end, duration } = parseMobileDateContainer(dateContainer);
  const location = el.querySelector('.text-xs span')?.textContent?.trim() ?? '';
  const description = el.querySelector('div.description')?.textContent?.trim() ?? '';
  return {
    title, company, start, end, duration, location, description,
    durationYears: parseDurationToYears(duration),
  };
}

function extractMobileSingleRole(el: HTMLElement): MobileExperienceEntry {
  const a = el.querySelector<HTMLElement>('a');
  const title =
    a
      ?.querySelector('.body-medium-bold span, .list-item-heading span')
      ?.textContent?.trim() ?? '';

  const innerDiv = a?.querySelector<HTMLElement>('div.flex-1');
  const bodySmalls = innerDiv
    ? Array.from(innerDiv.querySelectorAll<HTMLElement>(':scope > div.body-small:not(.truncated-summary)'))
    : [];
  const company = bodySmalls[0]?.querySelector('span')?.textContent?.trim() ?? '';
  const { start, end, duration } = parseMobileDateContainer(bodySmalls[1] ?? null);
  const description = a?.querySelector('div.description')?.textContent?.trim() ?? '';
  return {
    title, company, start, end, duration, location: '', description,
    durationYears: parseDurationToYears(duration),
  };
}

function parseMobileDateContainer(
  el: HTMLElement | null
): { start: string; end: string; duration: string } {
  if (!el) return { start: '', end: '', duration: '' };

  const spans = Array.from(el.querySelectorAll('span'));
  const dateParts = spans
    .filter((s) => s.classList.contains('body-small'))
    .map((s) => s.textContent?.replace(/-/g, '').trim())
    .filter(Boolean) as string[];

  const durationSpan = spans.find((s) => /\d+\s*(?:yr|mo)/.test(s.textContent ?? ''));
  const duration = durationSpan?.textContent?.trim() ?? '';

  return { start: dateParts[0] ?? '', end: dateParts[1] ?? '', duration };
}

// --- Mobile: Education ---

interface EducationEntry {
  school: string;
  degree: string;
  field: string;
  years: string;
}

function extractMobileEducation(): { educationList: EducationEntry[]; education: string } {
  const section = document.querySelector('section.education-container');
  if (!section) return { educationList: [], education: '' };

  const educationList: EducationEntry[] = [];

  for (const li of section.querySelectorAll<HTMLElement>('ol > li.entity-lockup')) {
    const a = li.querySelector<HTMLElement>('a');
    if (!a) continue;

    const school =
      a.querySelector('.body-medium-bold span, .list-item-heading span')
        ?.textContent?.trim() ?? '';

    const degreeDiv = a.querySelector<HTMLElement>(
      'div.body-small.text-color-text:not(.text-color-text-low-emphasis)'
    );
    const degreeSpans = degreeDiv ? Array.from(degreeDiv.querySelectorAll('span')) : [];
    const degree = degreeSpans[0]?.textContent?.trim() ?? '';
    const field = degreeSpans[1]?.textContent?.trim() ?? '';

    const yearsDiv = a.querySelector<HTMLElement>('div.body-small.text-color-text-low-emphasis');
    const yearParts = yearsDiv
      ? Array.from(yearsDiv.querySelectorAll('span.body-small'))
          .map((s) => s.textContent?.replace(/-/g, '').trim())
          .filter(Boolean)
      : [];
    const years = yearParts.join(' - ');

    if (school) educationList.push({ school, degree, field, years });
  }

  return buildEducationSummary(educationList);
}

// ============================================================================
// DESKTOP parser  (LinkedIn www.linkedin.com DOM structure, as of 2025)
//
// Key patterns:
//   h1.t-24.break-words                      — candidate name
//   div.text-body-medium.break-words          — headline/title (inside .ph5)
//   span.text-body-small.t-black--light       — location (inside .ph5)
//   section[data-view-name="profile-card"]    — all profile sections
//   h2.pvs-header__title                      — section headings ("About", "Experience", …)
//   span[aria-hidden="true"]                  — all visible text content
//
// Experience list entry types (detected by span[1] content):
//   Grouped  — company with multiple roles; span[1] is pure duration ("7 yrs 2 mos")
//   Single   — one role; span[1] is "Company · EmploymentType"
// ============================================================================

function extractDesktopLinkedIn(raw: Record<string, unknown>): CandidateData {
  const intro = extractDesktopIntro();
  const about = extractDesktopAbout();
  const { experiences, years_experience, experience_summary } = extractDesktopExperience();
  const { educationList, education } = extractDesktopEducation();

  // Infer current company from first experience entry if not found in intro
  const current_company = intro.current_company || experiences[0]?.company || '';

  raw.full_name = intro.full_name;
  raw.current_title = intro.current_title;
  raw.current_company = current_company;
  raw.location = intro.location;
  raw.about = about;
  raw.experiences = experiences;
  raw.education_list = educationList;
  raw.years_experience_calculated = years_experience;

  return {
    full_name: intro.full_name || 'Unknown',
    current_title: intro.current_title || undefined,
    current_company: current_company || undefined,
    location: intro.location || undefined,
    years_experience: years_experience || undefined,
    education: education || undefined,
    experience_summary: experience_summary || undefined,
    linkedin_url: window.location.href,
    source_platform: 'linkedin',
    raw_structured_data: raw,
  };
}

// --- Desktop: Basic info ---

function extractDesktopIntro(): IntroData {
  const h1 = document.querySelector('h1');
  const full_name = h1?.textContent?.trim() ?? '';

  // The intro card is wrapped in a .ph5 container
  const ph5 = h1?.closest('.ph5');

  // Headline: first div.text-body-medium.break-words
  const current_title =
    ph5?.querySelector('div.text-body-medium.break-words')?.textContent?.trim() ?? '';

  // Location: span.text-body-small.inline.t-black--light.break-words
  const location =
    ph5?.querySelector('span.text-body-small.inline.t-black--light.break-words')
      ?.textContent?.trim() ?? '';

  // Current company is not directly in the intro card on desktop;
  // it will be inferred from the first experience entry.
  return { full_name, current_title, current_company: '', location };
}

// --- Desktop: About ---

function extractDesktopAbout(): string {
  const aboutSection = findSectionByHeading('About');
  if (!aboutSection) return '';

  const spans = Array.from(aboutSection.querySelectorAll<HTMLElement>('span[aria-hidden="true"]'));
  // Filter out the heading text itself and short UI strings (buttons, etc.)
  return spans
    .map((s) => s.textContent?.trim() ?? '')
    .filter((t) => t && t !== 'About' && t !== 'Show more' && t !== 'Show less')
    .join(' ');
}

// --- Desktop: Experience ---

interface DesktopExperienceEntry {
  title: string;
  company: string;
  employmentType: string;
  start: string;
  end: string;
  duration: string;
  location: string;
  description: string;
  durationYears: number;
}

function extractDesktopExperience(): {
  experiences: DesktopExperienceEntry[];
  years_experience: number;
  experience_summary: string;
} {
  const expSection = findSectionByHeading('Experience');
  if (!expSection) return { experiences: [], years_experience: 0, experience_summary: '' };

  const topUl = expSection.querySelector('ul');
  if (!topUl) return { experiences: [], years_experience: 0, experience_summary: '' };

  const experiences: DesktopExperienceEntry[] = [];
  let totalDurationYears = 0;

  for (const li of Array.from(topUl.children)) {
    if (li.tagName !== 'LI') continue;

    const spans = getAriaHiddenSpans(li);
    if (spans.length === 0) continue;

    // Grouped detection: span[1] is a pure duration string without "·"
    // e.g. "7 yrs 2 mos"  vs  "Tencent · Full-time"
    const isGrouped =
      spans.length > 1 &&
      /^\d+\s*(yr|mo)/.test(spans[1]) &&
      !spans[1].includes('·');

    if (isGrouped) {
      const company = spans[0];
      // Use the company-level total duration (spans[1]) — NOT the sum of individual
      // role durations, which would double-count overlapping "Present" roles.
      totalDurationYears += parseDurationToYears(spans[1]);

      const nestedUl = li.querySelector('ul');
      if (nestedUl) {
        for (const roleLi of Array.from(nestedUl.children)) {
          if (roleLi.tagName !== 'LI') continue;
          // Description may be in a nested sub-ul; separate it from structural spans
          const roleSubUl = roleLi.querySelector('ul');
          const structSpans = getAriaHiddenSpansExcluding(roleLi, roleSubUl);
          if (structSpans.length === 0) continue;
          const description = roleSubUl
            ? getAriaHiddenSpans(roleSubUl).join(' ')
            : '';
          const entry = parseDesktopGroupedRole(structSpans, company, description);
          if (entry.title) experiences.push(entry);
        }
      }
    } else {
      // Single position: structural fields in top-level spans, description in nested ul
      const nestedUl = li.querySelector('ul');
      const structSpans = getAriaHiddenSpansExcluding(li, nestedUl);
      const description = nestedUl ? getAriaHiddenSpans(nestedUl).join(' ') : '';
      const entry = parseDesktopSingleRole(structSpans, description);
      if (entry.title) {
        totalDurationYears += entry.durationYears;
        experiences.push(entry);
      }
    }
  }

  const years_experience = Math.round(totalDurationYears * 10) / 10;

  const experience_summary = experiences
    .map((e) => {
      const parts: string[] = [e.title];
      if (e.company) parts.push(`at ${e.company}`);
      const dateStr = [e.start, e.end].filter(Boolean).join(' - ');
      const dateBlock = [dateStr, e.duration].filter(Boolean).join(', ');
      if (dateBlock) parts.push(`(${dateBlock})`);
      const lines = [parts.join(' ')];
      if (e.description) lines.push(`  ${e.description}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return { experiences, years_experience, experience_summary };
}

/**
 * Role inside a grouped company block.
 * Spans: [title, employmentType, "StartDate - EndDate · Duration", location?, description?]
 */
function parseDesktopGroupedRole(spans: string[], company: string, description: string): DesktopExperienceEntry {
  const title = spans[0] ?? '';
  const employmentType = spans[1] ?? '';
  const { start, end, duration } = parseDesktopDateStr(spans[2] ?? '');
  const location = spans[3] ?? '';

  return {
    title, company, employmentType, start, end, duration, location, description,
    durationYears: parseDurationToYears(duration),
  };
}

/**
 * Single-position entry (one role at one company).
 * Spans: [title, "Company · EmploymentType", "StartDate - EndDate · Duration", location?, description?]
 */
function parseDesktopSingleRole(spans: string[], description: string): DesktopExperienceEntry {
  const title = spans[0] ?? '';

  // "Company · EmploymentType" — split on first " · "
  const companyRaw = spans[1] ?? '';
  const dotIdx = companyRaw.indexOf(' · ');
  const company = dotIdx >= 0 ? companyRaw.substring(0, dotIdx).trim() : companyRaw.trim();
  const employmentType = dotIdx >= 0 ? companyRaw.substring(dotIdx + 3).trim() : '';

  const { start, end, duration } = parseDesktopDateStr(spans[2] ?? '');
  // spans[3] is location (if present); description comes from the nested ul, not spans
  const location = spans[3] ?? '';

  return {
    title, company, employmentType, start, end, duration, location, description,
    durationYears: parseDurationToYears(duration),
  };
}

/**
 * Parse "StartDate - EndDate · Duration" format.
 * e.g. "Feb 2025 - Present · 1 yr 3 mos"
 * e.g. "Jul 2008 - Mar 2015 · 6 yrs 9 mos"
 */
function parseDesktopDateStr(dateStr: string): { start: string; end: string; duration: string } {
  if (!dateStr) return { start: '', end: '', duration: '' };

  const dotIdx = dateStr.indexOf(' · ');
  const dateRange = dotIdx >= 0 ? dateStr.substring(0, dotIdx) : dateStr;
  const duration = dotIdx >= 0 ? dateStr.substring(dotIdx + 3).trim() : '';

  const dashIdx = dateRange.indexOf(' - ');
  const start = dashIdx >= 0 ? dateRange.substring(0, dashIdx).trim() : dateRange.trim();
  const end = dashIdx >= 0 ? dateRange.substring(dashIdx + 3).trim() : '';

  return { start, end, duration };
}

// --- Desktop: Education ---

function extractDesktopEducation(): { educationList: EducationEntry[]; education: string } {
  const eduSection = findSectionByHeading('Education');
  if (!eduSection) return { educationList: [], education: '' };

  const topUl = eduSection.querySelector('ul');
  if (!topUl) return { educationList: [], education: '' };

  const educationList: EducationEntry[] = [];

  for (const li of Array.from(topUl.children)) {
    if (li.tagName !== 'LI') continue;

    const spans = getAriaHiddenSpans(li);
    if (spans.length === 0) continue;

    // Spans: [school, "Degree, Field of Study", "StartYear - EndYear"]
    const school = spans[0] ?? '';
    const degreeAndField = spans[1] ?? '';
    const years = spans[2] ?? '';

    // Parse "Bachelor of Arts, 传播学" → degree + field
    const commaIdx = degreeAndField.indexOf(',');
    const degree = commaIdx >= 0 ? degreeAndField.substring(0, commaIdx).trim() : degreeAndField;
    const field = commaIdx >= 0 ? degreeAndField.substring(commaIdx + 1).trim() : '';

    if (school) educationList.push({ school, degree, field, years });
  }

  return buildEducationSummary(educationList);
}

// ============================================================================
// Shared utilities
// ============================================================================

/** Find a profile section by its h2 heading text. */
function findSectionByHeading(heading: string): Element | null {
  for (const section of Array.from(document.querySelectorAll('section'))) {
    const h2Text = section.querySelector('h2.pvs-header__title')?.textContent ?? '';
    if (h2Text.includes(heading)) return section;
  }
  return null;
}

/** Get all visible text spans (aria-hidden="true") inside an element, trimmed and non-empty. */
function getAriaHiddenSpans(el: Element): string[] {
  return Array.from(el.querySelectorAll('span[aria-hidden="true"]'))
    .map((s) => s.textContent?.trim() ?? '')
    .filter(Boolean);
}

/**
 * Like getAriaHiddenSpans but skips spans that are descendants of `exclude`.
 * Used to separate structural fields from description (which lives in a nested ul).
 */
function getAriaHiddenSpansExcluding(el: Element, exclude: Element | null): string[] {
  return Array.from(el.querySelectorAll('span[aria-hidden="true"]'))
    .filter((s) => !exclude?.contains(s))
    .map((s) => s.textContent?.trim() ?? '')
    .filter(Boolean);
}

/** Convert a duration string like "6 yrs 9 mos" to a decimal year count. */
function parseDurationToYears(dur: string): number {
  if (!dur) return 0;
  const yrs = dur.match(/(\d+)\s*yr/)?.[1];
  const mos = dur.match(/(\d+)\s*mo/)?.[1];
  return (yrs ? parseInt(yrs, 10) : 0) + (mos ? parseInt(mos, 10) : 0) / 12;
}

function buildExperienceSummary(experiences: MobileExperienceEntry[]): {
  experiences: MobileExperienceEntry[];
  years_experience: number;
  experience_summary: string;
} {
  const years_experience =
    Math.round(experiences.reduce((sum, e) => sum + e.durationYears, 0) * 10) / 10;

  const experience_summary = experiences
    .map((e) => {
      const parts: string[] = [e.title];
      if (e.company) parts.push(`at ${e.company}`);
      const dateStr = [e.start, e.end].filter(Boolean).join(' - ');
      const dateBlock = [dateStr, e.duration].filter(Boolean).join(', ');
      if (dateBlock) parts.push(`(${dateBlock})`);
      const lines = [parts.join(' ')];
      if (e.description) lines.push(`  ${e.description}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return { experiences, years_experience, experience_summary };
}

function buildEducationSummary(educationList: EducationEntry[]): {
  educationList: EducationEntry[];
  education: string;
} {
  const education = educationList
    .map((e) => {
      let s = e.school;
      if (e.degree) s += ` - ${e.degree}`;
      if (e.field) s += ` (${e.field})`;
      if (e.years) s += ` ${e.years}`;
      return s;
    })
    .join('; ');

  return { educationList, education };
}
