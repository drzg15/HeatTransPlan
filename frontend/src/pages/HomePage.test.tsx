/** The preview page in both languages: every text is there in that language
 *  (no raw keys, no English left on the German page), with the project link
 *  and both QR codes. */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import en from '../locales/en.json';
import HomePage from './HomePage';

afterEach(cleanup);

function page(lng: string) {
  void i18n.changeLanguage(lng);
  const { container } = render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
  return container;
}

describe('home preview', () => {
  it.each(['en', 'de'])('shows every text in %s, none as a raw key', (lng) => {
    const text = page(lng).textContent ?? '';
    expect(text).not.toMatch(/home_preview\.|analysis\.parts\.|appshell\.|home\.[a-z_]+/);
  });

  it('is German on the German page, part titles as on the analysis page', () => {
    const text = page('de').textContent ?? '';
    for (const word of [
      'So funktioniert es',
      'Potenzialanalyse',
      'Was macht die Pinch-Analyse?',
      'Zur Projekt-Website',
    ])
      expect(text).toContain(word);
    for (const english of [
      en.home_preview.how_title,
      en.home_preview.integration_more_title,
      en.home_preview.project_link,
    ])
      expect(text).not.toContain(english);
    expect(text).toContain(i18n.t('analysis.parts.heat_pump', { lng: 'de' }));
  });

  it('links the project website and shows both QR codes', () => {
    const c = page('en');
    expect(c.querySelector('a[href="https://www.heattransplan.de/"]')).not.toBeNull();
    const codes = [...c.querySelectorAll('img[src*="create-qr-code"]')].map(
      (img) => img.getAttribute('src') ?? ''
    );
    expect(codes).toHaveLength(2);
    expect(codes[1]).toContain(encodeURIComponent(`${window.location.origin}/`));
  });
});
