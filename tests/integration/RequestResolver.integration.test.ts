import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestResolver } from '../../src/core/RequestResolver';
import { MemoryCache } from '../../src/cache/MemoryCache';

describe('RequestResolver – refresh buffer (integration)', () => {
	let cache: MemoryCache;
	let resolver: RequestResolver;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		cache = new MemoryCache();
		resolver = new RequestResolver(cache);
		vi.useFakeTimers();
		originalFetch = global.fetch;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.useRealTimers();
	});

	it('should refresh before expiry using refreshBufferSeconds', async () => {
		// Mock fetch for the first response
		global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({ token: 'fresh' })
		});

		vi.setSystemTime(Date.now());

		const config = {
			cacheKey: 'token',
			cacheTTL: 60, // 60 seconds
			refreshBufferSeconds: 10 // refresh 10 seconds before expiry
		};

		// First request – stores in cache
		const data1 = await resolver.request<{ token: string }>(
			'https://api.example.com/token',
			{},
			config
		);
		expect(data1.token).toBe('fresh');
		expect(global.fetch).toHaveBeenCalledTimes(1);

		// Advance 55 seconds – buffer window is triggered (5s left, buffer 10s)
		vi.advanceTimersByTime(55000);

		// Mock fetch for the second response (refresh)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ token: 'updated' })
		});

		// Second request – should perform a real fetch because the cached item is about to expire
		const data2 = await resolver.request<{ token: string }>(
			'https://api.example.com/token',
			{},
			config
		);
		expect(data2.token).toBe('updated');
		expect(global.fetch).toHaveBeenCalledTimes(2);

		// Verify the cache now holds the updated value
		const cached = await resolver.getCacheItem<{ token: string }>('token');
		expect(cached?.value.token).toBe('updated');
	});
});
