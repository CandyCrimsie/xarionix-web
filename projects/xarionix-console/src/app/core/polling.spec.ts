import { Subject, of, throwError } from 'rxjs';
import { poll } from './polling';
describe('bounded polling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('never overlaps requests', async () => {
    const pending = new Subject<number>();
    const request = vi.fn(() => pending);
    const received = vi.fn();
    const sub = poll(request, received, vi.fn(), 100, 1000);
    await vi.advanceTimersByTimeAsync(450);
    expect(request).toHaveBeenCalledTimes(1);
    pending.next(1);
    pending.complete();
    await vi.advanceTimersByTimeAsync(100);
    expect(request).toHaveBeenCalledTimes(2);
    sub.unsubscribe();
  });
  it('ends at the deadline', async () => {
    const request = vi.fn(() => of(1));
    poll(request, vi.fn(), vi.fn(), 100, 350);
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(4);
  });
  it('cancels an in-flight HTTP subscription at the deadline and ignores its late response', async () => {
    const pending = new Subject<number>(),
      received = vi.fn();
    const sub = poll(() => pending, received, vi.fn(), 100, 350);
    await vi.advanceTimersByTimeAsync(1);
    expect(pending.observed).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    expect(pending.observed).toBe(false);
    expect(sub.closed).toBe(true);
    pending.next(42);
    expect(received).not.toHaveBeenCalled();
  });
  it('stops on errors instead of creating a 429 or unauthorized retry storm', async () => {
    const request = vi.fn(() => throwError(() => new Error('429'))),
      failure = vi.fn();
    poll(request, vi.fn(), failure, 100, 1000);
    await vi.advanceTimersByTimeAsync(500);
    expect(request).toHaveBeenCalledOnce();
    expect(failure).toHaveBeenCalledOnce();
  });
  it('cleans timers on owner destruction', async () => {
    const request = vi.fn(() => of(1));
    const sub = poll(request, vi.fn(), vi.fn(), 100, 1000);
    await vi.advanceTimersByTimeAsync(1);
    sub.unsubscribe();
    await vi.advanceTimersByTimeAsync(500);
    expect(request).toHaveBeenCalledOnce();
  });
});
