import {
  Observable,
  Subject,
  Subscription,
  catchError,
  exhaustMap,
  of,
  takeUntil,
  timer,
} from 'rxjs';

// One in-flight request, bounded lifetime, explicit owner cleanup; no recursive retries.
export function poll<T>(
  request: () => Observable<T>,
  onValue: (value: T) => void,
  onError: (error: unknown) => void,
  interval = 5000,
  timeout = 600000,
): Subscription {
  const stop = new Subject<void>();
  const sub = timer(0, interval)
    .pipe(
      exhaustMap(() =>
        request().pipe(
          catchError((error) => {
            onError(error);
            stop.next();
            return of(null);
          }),
        ),
      ),
      // Terminate the inner HTTP subscription too, not just future timer ticks.
      takeUntil(timer(timeout)),
      takeUntil(stop),
    )
    .subscribe((value) => {
      if (value !== null) onValue(value);
    });
  sub.add(() => {
    stop.next();
    stop.complete();
  });
  return sub;
}
