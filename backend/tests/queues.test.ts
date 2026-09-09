import { isQueueEnabled } from '../src/config/redis.js';
import { enqueueNotification } from '../src/queues/notifications.queue.js';

// With no REDIS_URL configured (the test environment), queues are disabled and
// notification work runs inline. This verifies the graceful-degradation signal
// without needing a running Redis.
describe('Queues (no Redis configured)', () => {
  it('reports queues disabled', () => {
    expect(isQueueEnabled()).toBe(false);
  });

  it('does not enqueue and signals inline handling', async () => {
    const enqueued = await enqueueNotification({
      organizationId: '000000000000000000000001',
      userId: '000000000000000000000002',
      type: 'TICKET_ASSIGNED',
      title: 'test',
    });
    expect(enqueued).toBe(false);
  });
});
