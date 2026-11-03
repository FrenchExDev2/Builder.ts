import { FeatureTest, Verifies } from '@frenchexdev2/requirements-shared-kernel';
import { BuilderCancellationFeature } from '@frenchexdev2/builder-requirements';
import { getEventListeners } from 'node:events';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@builder-internal/internal/wait-for';

describe('caller-local cancellation', () => {
  
@FeatureTest(BuilderCancellationFeature)
class waitfortesttsCase1 {
  @Verifies<BuilderCancellationFeature>('rejectsAnAlreadyAbortedWaitEvenWhenTheWorkHasAlreadySucceeded')
  async verify() {
    const controller = new AbortController();
    const reason = new Error('Already cancelled');
    controller.abort(reason);
    await expect(waitFor(Promise.resolve(42), controller.signal)).rejects.toBe(reason);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  }
}
it('rejects an already aborted wait even when the work has already succeeded', new waitfortesttsCase1().verify.bind(new waitfortesttsCase1()));

  
@FeatureTest(BuilderCancellationFeature)
class waitfortesttsCase2 {
  @Verifies<BuilderCancellationFeature>('releasesTheAbortListenerImmediatelyWhenCancellingWorkThatStaysPending')
  async verify() {
    const controller = new AbortController();
    const waiting = waitFor(new Promise<never>(() => {}), controller.signal);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
    controller.abort('Cancelled');
    await expect(waiting).rejects.toBe('Cancelled');
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  }
}
it('releases the abort listener immediately when cancelling work that stays pending', new waitfortesttsCase2().verify.bind(new waitfortesttsCase2()));
});
