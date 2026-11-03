import { useState } from 'react';

const FONT: Record<string, string> = { ar: 'hand-ar', ko: 'hand-ko', el: 'hand-el' };
const NAME: Record<string, string> = { ar: 'Arabic', ko: 'Korean', fr: 'French', el: 'Greek', it: 'Italian', es: 'Spanish' };

/** Original text in its own script with a "Show translation" toggle. */
export function Translatable({ lang, dir, original, translation }: { lang: string; dir?: string; original: string[]; translation?: string[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="translatable">
      <div className={`hand ${FONT[lang] ?? 'hand-latin'}`} lang={lang} dir={dir ?? (lang === 'ar' ? 'rtl' : 'ltr')}>
        {original.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      {translation && (
        <>
          <button type="button" className="btn small translate-toggle" aria-expanded={show} onClick={() => setShow(!show)}>
            {show ? 'Hide translation' : `Show translation (${NAME[lang] ?? lang})`}
          </button>
          {show && <div className="translation" lang="en">{translation.map((l, i) => <p key={i}>{l}</p>)}</div>}
        </>
      )}
    </div>
  );
}
