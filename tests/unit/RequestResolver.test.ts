import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestResolver } from '../../src/core/RequestResolver.js';
import { MemoryCache } from '../../src/cache/MemoryCache.js';

describe('RequestResolver - TTL and expiration', () => {
	let cache: MemoryCache;
	let resolver: RequestResolver;

	beforeEach(() => {
		cache = new MemoryCache();
		resolver = new RequestResolver(cache);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return cached item if not expired', async () => {
		vi.setSystemTime(Date.now());

		// Set item with TTL 10 seconds
		await resolver.setCacheItem('test', 'cached-value', 10);

		// Advance 5 seconds – still valid
		vi.advanceTimersByTime(5000);

		const result = await resolver.getCacheItem('test');
		expect(result?.value).toBe('cached-value');
	});

	it('should return undefined and remove from cache if expired', async () => {
		vi.setSystemTime(Date.now());

		// Set item with TTL 10 seconds
		await resolver.setCacheItem('test', 'cached-value', 10);

		// Advance 11 seconds – expired
		vi.advanceTimersByTime(11000);

		const result = await resolver.getCacheItem('test');
		expect(result).toBeUndefined();

		// Verify the item was actually removed from the store
		const stored = await cache.get('test');
		expect(stored).toBeUndefined();
	});

	it('should never expire if TTL is null', async () => {
		vi.setSystemTime(Date.now());

		await resolver.setCacheItem('test', 'permanent', null);

		// Advance 100 years
		vi.advanceTimersByTime(100 * 365 * 24 * 60 * 60 * 1000);

		const result = await resolver.getCacheItem('test');
		expect(result?.value).toBe('permanent');
	});
});
