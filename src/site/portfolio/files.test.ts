import { describe, expect, it } from 'vitest';
import { fetchFiles } from './files';

describe("the portfolio page's files", () => {
  it('asks for the facts and the closes by file, never by symbol; a failure is no file', async () => {
    const asked: string[] = [];
    const ok = (async (u: string) => { asked.push(String(u)); return Response.json({ v: 1 }); }) as unknown as typeof fetch;
    const files = fetchFiles('b20261107t1806', ok);
    expect(await files.facts()).toEqual({ v: 1 });
    await files.closes('1y');
    await files.closes('2024');
    expect(await files.closes('AAPL')).toBeNull(); // a symbol is never a file
    expect(asked).toEqual(['/data/facts-v1.json?v=b20261107t1806', '/data/closes-1y-v1.json?v=b20261107t1806', '/data/closes-2024-v1.json?v=b20261107t1806']);
    expect(await fetchFiles('b', (async () => new Response('', { status: 404 })) as unknown as typeof fetch).facts()).toBeNull();
    expect(await fetchFiles('b', (async () => { throw new Error('offline'); }) as unknown as typeof fetch).facts()).toBeNull();
  });

  it('loads the one sheet of logos once, never a file that names a company; a sheet that does not come is no logo', async () => {
    const loaded: string[] = [];
    const files = fetchFiles('b', fetch, async (src) => { loaded.push(src); return null; });
    const sheet = { file: '/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: ['AAPL', 'MSFT'] };
    expect(await files.logos({ ...sheet, file: '/logos/aapl.1a2b3c4d.webp' }, ['AAPL'])).toEqual(new Map());
    expect(await files.logos(sheet, ['AAPL'])).toEqual(new Map());
    expect(await files.logos(sheet, ['MSFT'])).toEqual(new Map());
    expect(loaded).toEqual(['/logos/sprite.1a2b3c4d.webp']);
  });
});
