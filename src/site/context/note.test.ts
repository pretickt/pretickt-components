import { describe, expect, it } from 'vitest';
import type { ClickNote } from '../../context/click';
import { companyPageOf, dropNote, landingNote, NOTE_KEY, NOTE_TTL_MS, writeNote, type NoteStore } from './note';

const memory = (): NoteStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const throwing: NoteStore = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

const note: ClickNote = {
  v: 1, to: 'NVDA', land: '/stocks/nvda/', at: Date.UTC(2026, 10, 16, 20, 40), from: { path: '/', title: 'pretickt' },
  kind: 'news', d: { title: 'Nvidia beats', url: 'https://example.com/a', site: 'example.com', publishedAt: '2026-11-16T14:00:00Z' },
};
const here = { path: '/stocks/nvda/', subject: 'NVDA', search: '' };

describe('companyPageOf', () => {
  it('reads the company page of a link: the hub and its sub-pages, a hash dropped, the ticker upper-cased', () => {
    expect(companyPageOf('/stocks/nvda/')).toEqual({ ticker: 'NVDA', path: '/stocks/nvda/' });
    expect(companyPageOf('/stocks/nvda/earnings/')).toEqual({ ticker: 'NVDA', path: '/stocks/nvda/earnings/' });
    expect(companyPageOf('/stocks/brk.b/#people-ask')).toEqual({ ticker: 'BRK.B', path: '/stocks/brk.b/' });
  });
  it('nothing for a fund, the A–Z list or another site', () => {
    expect(companyPageOf('/etfs/xlk/')).toBeNull();
    expect(companyPageOf('/stocks/')).toBeNull();
    expect(companyPageOf('https://x.com/stocks/nvda/')).toBeNull();
  });
});

describe('the note', () => {
  it('round trip: what was written is what the landing reads', () => {
    const mem = memory();
    writeNote(mem, note);
    expect(landingNote(mem, here, note.at + 1000)).toEqual(note);
  });

  const cases: [string, Partial<typeof here>, number, Partial<ClickNote> | string | null][] = [
    ['another company', { subject: 'AMD' }, 1000, {}],
    ['another page of the company', { path: '/stocks/nvda/news/' }, 1000, {}],
    ['older than 30 minutes', {}, NOTE_TTL_MS + 1, {}],
    ['an alert in the address', { search: '?alert=AbCdEf0123456789_-xy' }, 1000, {}],
    ['clicked on this very page', {}, 1000, { from: { path: '/stocks/nvda/', title: 'x' } }],
    ['an unknown kind', {}, 1000, { kind: 'nope' } as unknown as Partial<ClickNote>],
    ['another version', {}, 1000, { v: 2 } as unknown as Partial<ClickNote>],
    ['malformed JSON', {}, 1000, '{bad json'],
  ];
  for (const [what, place, after, change] of cases) {
    it(`nothing for ${what}`, () => {
      const mem = memory();
      mem.data.set(NOTE_KEY, typeof change === 'string' ? change : JSON.stringify({ ...note, ...change }));
      expect(landingNote(mem, { ...here, ...place }, note.at + after)).toBeNull();
    });
  }

  it('nothing without storage, or when storage throws; writing and dropping never throw', () => {
    expect(landingNote(null, here, note.at)).toBeNull();
    expect(landingNote(throwing, here, note.at)).toBeNull();
    expect(() => writeNote(throwing, note)).not.toThrow();
    expect(() => dropNote(throwing)).not.toThrow();
    expect(() => writeNote(null, note)).not.toThrow();
  });

  it('dropNote removes it', () => {
    const mem = memory();
    writeNote(mem, note);
    dropNote(mem);
    expect(mem.data.has(NOTE_KEY)).toBe(false);
  });
});
