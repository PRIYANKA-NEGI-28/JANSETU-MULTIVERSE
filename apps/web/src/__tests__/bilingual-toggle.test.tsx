import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LangProvider, useLang } from '../contexts/LangContext.js';
import '../lib/i18n.js';

function LanguageTestConsumer() {
  const { lang, toggleLang, setLang, T, t } = useLang();

  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <span data-testid="nav-track">{T['nav_track'] || 'Track Status'}</span>
      <span data-testid="nav-home">{T['nav_home'] || 'Home'}</span>
      <span data-testid="custom-t">{t('nav_file', 'File Complaint')}</span>
      <button type="button" onClick={toggleLang} data-testid="toggle-btn">
        Toggle Language
      </button>
      <button type="button" onClick={() => setLang('hi')} data-testid="set-hi-btn">
        Set Hindi
      </button>
      <button type="button" onClick={() => setLang('en')} data-testid="set-en-btn">
        Set English
      </button>
    </div>
  );
}

describe('Bilingual Language Toggle & i18n Foundation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders with default language and provides English translations', () => {
    render(
      <LangProvider>
        <LanguageTestConsumer />
      </LangProvider>
    );

    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
    expect(screen.getByTestId('nav-track').textContent).toBeTruthy();
  });

  it('toggles language to Hindi and updates translation keys', () => {
    render(
      <LangProvider>
        <LanguageTestConsumer />
      </LangProvider>
    );

    const toggleBtn = screen.getByTestId('toggle-btn');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('current-lang')).toHaveTextContent('hi');
    expect(localStorage.getItem('jansetu_lang')).toBe('hi');

    // Toggling again returns to English
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
    expect(localStorage.getItem('jansetu_lang')).toBe('en');
  });

  it('allows setting language explicitly via setLang', () => {
    render(
      <LangProvider>
        <LanguageTestConsumer />
      </LangProvider>
    );

    const setHiBtn = screen.getByTestId('set-hi-btn');
    fireEvent.click(setHiBtn);

    expect(screen.getByTestId('current-lang')).toHaveTextContent('hi');

    const setEnBtn = screen.getByTestId('set-en-btn');
    fireEvent.click(setEnBtn);

    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
  });
});
