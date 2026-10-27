import { TestBed } from '@angular/core/testing';
import { REGISTRY } from '../site/registry.generated';
import { getTypology } from '../typologies';
import { STORIES } from './index';
import { PtStory, story, type StoryConfiguration } from './story';
import { indexOf, routeOf } from './visual';
import { PtNews } from '../../components/pt-news';

/** A story mounted the way the stories page mounts it, its answers arrived (a browser store: nothing waits for them by itself). */
async function mount(s: StoryConfiguration) {
  TestBed.resetTestingModule();
  const f = TestBed.createComponent(PtStory);
  f.componentRef.setInput('configuration', { ...s, run: undefined }); // run plays a second later, after the test
  f.detectChanges();
  for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); }
  return f.nativeElement as HTMLElement;
}

describe('stories', () => {
  it('every component has stories, each with a name of its own', () => {
    expect(Object.keys(REGISTRY).filter((tag) => !STORIES.some((s) => s.tag === tag))).toEqual([]);
    const names = STORIES.map((s) => `${s.tag}: ${s.name ?? ''}`);
    expect(names.filter((n, i) => n.endsWith(': ') || names.indexOf(n) !== i)).toEqual([]);
  });

  it('a fixture is a payload its typology accepts (a catalogue entry a newer API may send aside)', () => {
    const bad: string[] = [];
    for (const s of STORIES) for (const [t, v] of Object.entries(s.data ?? {})) {
      if (v === null || typeof v === 'function' || /newer API|never seen/.test(s.name ?? '')) continue;
      const r = getTypology(t)?.payload.safeParse(v);
      if (!r?.success) bad.push(`${s.tag}: ${s.name} → ${t}`);
    }
    expect(bad).toEqual([]);
  });

  for (const s of STORIES.filter((x) => !x.live)) {
    it(`renders ${s.tag}: ${s.name}`, async () => {
      const el = await mount(s);
      expect(el.querySelector(s.tag)).toBeTruthy();
      expect(el.textContent!.trim()).not.toBe('');
      if (s.data === null) expect(el.querySelector('.pt-na')).toBeTruthy();
    });
  }

  it('story() takes inputs alone (browserbot\'s short form) or options; the tag is the selector', () => {
    expect(story(PtNews, { ticker: 'NVDA', limit: 5 })).toMatchObject({ tag: 'pt-news', inputs: { ticker: 'NVDA', limit: 5 } });
    expect(story(PtNews, { name: 'x', inputs: { ticker: 'NVDA' }, data: null })).toMatchObject({ tag: 'pt-news', name: 'x', data: null });
  });

  it('reads its address: the index, a component\'s stories, one story alone, phone frames', () => {
    expect(routeOf('/', '')).toEqual({ tag: null, n: null, phone: false });
    expect(routeOf('/visual/pt-movers', '?phone')).toEqual({ tag: 'pt-movers', n: null, phone: true });
    expect(routeOf('/visual/pt-movers/3', '')).toEqual({ tag: 'pt-movers', n: 3, phone: false });
    const groups = indexOf(STORIES);
    expect(groups[0]!.name).toBe('Components');
    expect(groups[0]!.tags.find((t) => t.tag === 'pt-movers')).toMatchObject({ version: REGISTRY['pt-movers']!.version });
  });
});
