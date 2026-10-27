import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { experimentsCss, experimentsModule, readExperiments } from './stories-experiments';

function experiments() {
  const root = mkdtempSync(join(tmpdir(), 'pt-experiments-'));
  const dir = join(root, 'episodes');
  mkdirSync(dir);
  writeFileSync(join(dir, 'README.md'), '# Episodi\n\nUn motivo per tornare.');
  writeFileSync(join(dir, 'pt-ep-news.ts'), '/** @tag pt-ep-news */\nexport class PtEpNews {}\n');
  writeFileSync(join(dir, 'pt-ep-news.scenarios.json'), '[{"name":"NVDA live","props":{"ticker":"NVDA"},"base":"live"}]');
  writeFileSync(join(dir, 'pt-ep-macro.ts'), 'export class PtEpMacro {}\n'); // no presets
  writeFileSync(join(dir, 'pt-ep-macro.spec.ts'), 'export {};'); // not a component
  writeFileSync(join(dir, 'helpers.ts'), 'export const x = 1;');
  writeFileSync(join(dir, 'episodes.css'), '.ep { display: grid; }');
  mkdirSync(join(root, '.cache'));
  return root;
}

describe('the platform\'s experiments as stories', () => {
  it('reads each experiment like the admin bench: title, components with their presets, css', () => {
    const [e, ...rest] = readExperiments(experiments());
    expect(rest).toEqual([]);
    expect(e).toMatchObject({ slug: 'episodes', title: 'Episodi', css: '.ep { display: grid; }' });
    expect(e!.components.map((c) => [c.tag, c.className, c.scenarios])).toEqual([
      ['pt-ep-macro', 'PtEpMacro', '[]'],
      ['pt-ep-news', 'PtEpNews', '[{"name":"NVDA live","props":{"ticker":"NVDA"},"base":"live"}]'],
    ]);
  });

  it('writes the module the stories app imports: each component from its copy, its presets as stories under the experiment', () => {
    const out = experimentsModule(readExperiments(experiments()));
    expect(out).toContain("import { PtEpNews } from './experiments/episodes/pt-ep-news';");
    expect(out).toContain('...scenarioStories(PtEpNews, "Experiments · Episodi", [{"name":"NVDA live","props":{"ticker":"NVDA"},"base":"live"}]),');
    expect(out).toContain('...scenarioStories(PtEpMacro, "Experiments · Episodi", []),');
    expect(experimentsCss(readExperiments(experiments()))).toBe('/* episodes */\n.ep { display: grid; }\n');
  });

  it('no platform checkout: no experiments, an empty list of stories', () => {
    expect(readExperiments(join(tmpdir(), 'pt-no-such-dir'))).toEqual([]);
    expect(experimentsModule([])).toContain('export const stories: StoryConfiguration[] = [\n];');
  });
});
