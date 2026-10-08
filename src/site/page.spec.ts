import { TestBed } from '@angular/core/testing';
import { PtPage } from './page';

describe('PtPage', () => {
  it('renders', async () => {
    const f = TestBed.createComponent(PtPage);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).textContent).toContain('pretickt');
  });
});
