import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { AttentionParams, AttentionPayload, attentionDemo } from './attention';
import { getTypology } from './index';

describe('attention@1: how much a company was in the news on the session\'s day, against its usual day', () => {
  it('asks for the news, up to 100 companies, 40 by default', () => {
    expect(AttentionParams.parse({ lens: 'news' })).toEqual({ lens: 'news', limit: 40 });
    expect(AttentionParams.safeParse({ lens: 'news', limit: 101 }).success).toBe(false);
    expect(AttentionParams.safeParse({ lens: 'tv' }).success).toBe(false);
    expect(needKey({ t: 'attention@1', params: { lens: 'news', limit: 40 } })).toBe('attention@1|{"lens":"news","limit":40}');
  });
  it('the demo: the most covered first, each with its usual day, its move and its size — a valid payload', () => {
    const d = attentionDemo(AttentionParams.parse({ lens: 'news', limit: 8 }));
    expect(AttentionPayload.safeParse(d).success).toBe(true);
    expect(d.rows).toHaveLength(8);
    expect(d.rows.map((r) => r.count)).toEqual([...d.rows.map((r) => r.count)].sort((a, b) => b - a));
    expect(getTypology('attention@1')).toBeTruthy();
  });
});
