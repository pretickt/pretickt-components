import { describe, expect, it } from 'vitest';
import { needPath, typologyInPath } from './page';

describe('page contract', () => {
  it('one URL shape for a need, written by the host and read by the API', () => {
    const path = needPath({ t: 'metric@1', params: { ticker: 'MSFT', metrics: ['pe'] } }, 'b1');
    expect(path).toBe('/v1/t/metric%401?p=%7B%22metrics%22%3A%5B%22pe%22%5D%2C%22ticker%22%3A%22MSFT%22%7D&b=b1');
    expect(typologyInPath(new URL(`https://x${path}`).pathname)).toBe('metric@1');
    expect(typologyInPath('/v1/t/metric@1')).toBe('metric@1');
    for (const bad of ['/v1/t/nope', '/v1/t/%E0%A4%A', '/v1/t/metric@1/x', '/v2/t/metric@1']) expect(typologyInPath(bad), bad).toBeNull();
  });
});
