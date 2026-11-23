import { describe, it, expect } from 'vitest';
import { t } from '../i18n.js';

describe('Bilingual i18n Dictionary', () => {
  it('contains both en and hi language objects', () => {
    expect(t.en).toBeDefined();
    expect(t.hi).toBeDefined();
  });

  it('guarantees key parity across English and Hindi dictionaries', () => {
    const enKeys = Object.keys(t.en).sort();
    const hiKeys = Object.keys(t.hi).sort();

    expect(enKeys.length).toBeGreaterThanOrEqual(470);
    expect(hiKeys.length).toBeGreaterThanOrEqual(470);

    const missingInHi = enKeys.filter(k => !(k in t.hi));
    const missingInEn = hiKeys.filter(k => !(k in t.en));

    expect(missingInHi).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('preserves essential core navigation strings', () => {
    expect(t.en.nav_home).toBe('Home');
    expect(t.hi.nav_home).toBe('होम');

    expect(t.en.nav_file).toBe('File Complaint');
    expect(t.hi.nav_file).toBe('शिकायत दर्ज करें');

    expect(t.en.nav_track).toBe('Track Status');
    expect(t.hi.nav_track).toBe('स्थिति ट्रैक करें');
  });

  it('supports dynamic template interpolations', () => {
    expect(t.en.submit_language_detected('hi')).toBe('Hindi detected');
    expect(t.en.submit_language_detected('en')).toBe('English detected');

    expect(t.en.hazard_report_count(1)).toBe('1 report');
    expect(t.en.hazard_report_count(5)).toBe('5 reports');
  });
});
