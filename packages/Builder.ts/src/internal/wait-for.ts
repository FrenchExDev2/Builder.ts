/** Waits with caller-local cancellation, preserving errors and removing listeners. */
// @rac-feature BUILDER-CANCELLATION
export async function waitFor<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return await pending;
  signal.throwIfAborted();
  return await new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void pending.then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}
