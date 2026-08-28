import { describe, it, expect, beforeEach, vi } from 'vitest';
import Redis from 'ioredis';
import { RedisCache } from '../../src/cache/RedisCache';
import type { CacheItem } from '../../src/types';

/**
 * Create a mock Redis instance that inherits from Redis.prototype
 * so that `instanceof Redis` returns true.
 */
function createMockRedis() {
	const store = new Map<string, string>();

	const mock = Object.create(Redis.prototype);

	mock.get = vi.fn(async (key: string) => store.get(key) || null);
	mock.set = vi.fn(async (key: string, value: string) => {
		store.set(key, value);
		return 'OK';
	});
	mock.del = vi.fn(async (...keys: string[]) => {
		let count = 0;
		for (const k of keys) {
			if (store.delete(k)) count++;
		}
		return count;
	});
	mock.keys = vi.fn(async (pattern: string) => {
		const prefix = pattern.replace('*', '');
		const result: string[] = [];
		for (const k of store.keys()) {
			if (k.startsWith(prefix)) result.push(k);
		}
		return result;
	});
	mock.ping = vi.fn(async () => 'PONG');
	mock.quit = vi.fn(async () => {});
	mock.ttl = vi.fn(async () => -1);

	return mock;
}

describe('RedisCache', () => {
	let mockRedis: ReturnType<typeof createMockRedis>;
	let cache: RedisCache;

	beforeEach(() => {
		mockRedis = createMockRedis();
		cache = new RedisCache({
			redis: mockRedis,
			keyPrefix: 'test:'
		});
	});

	describe('get', () => {
		it('should retrieve a stored item', async () => {
			const item: CacheItem<number> = { value: 42, expiry: null };
			const serialized = JSON.stringify(item);
			await mockRedis.set('test:key', serialized);

			const result = await cache.get<number>('key');
			expect(result).toEqual(item);
			expect(mockRedis.get).toHaveBeenCalledWith('test:key');
		});

		it('should return undefined if key does not exist', async () => {
			const result = await cache.get('missing');
			expect(result).toBeUndefined();
			expect(mockRedis.get).toHaveBeenCalledWith('test:missing');
		});

		it('should return undefined if stored JSON is invalid', async () => {
			await mockRedis.set('test:invalid', '{ not json');
			const result = await cache.get('invalid');
			expect(result).toBeUndefined();
		});
	});

	describe('set', () => {
		it('should store an item without TTL (expiry null)', async () => {
			const item: CacheItem<string> = { value: 'hello', expiry: null };
			await cache.set('key', item);

			expect(mockRedis.set).toHaveBeenCalledWith('test:key', JSON.stringify(item));
		});

		it('should store an item with TTL when expiry is set', async () => {
			const expiry = Date.now() + 5000;
			const item: CacheItem<string> = { value: 'hello', expiry };
			await cache.set('key', item);

			const ttlSeconds = Math.max(1, Math.floor((expiry - Date.now()) / 1000));
			expect(mockRedis.set).toHaveBeenCalledWith(
				'test:key',
				JSON.stringify(item),
				'EX',
				ttlSeconds
			);
		});

		it('should handle expiry in the past gracefully (TTL at least 1s)', async () => {
			const expiry = Date.now() - 1000;
			const item: CacheItem<string> = { value: 'hello', expiry };
			await cache.set('key', item);

			expect(mockRedis.set).toHaveBeenCalledWith(
				'test:key',
				JSON.stringify(item),
				'EX',
				expect.any(Number)
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const ttl = (mockRedis.set.mock.calls[0] as any)[3];
			expect(ttl).toBeGreaterThanOrEqual(1);
		});
	});

	describe('delete', () => {
		it('should delete a key', async () => {
			await cache.delete('key');
			expect(mockRedis.del).toHaveBeenCalledWith('test:key');
		});
	});

	describe('clear', () => {
		it('should delete all keys with the given prefix', async () => {
			await mockRedis.set('test:a', '1');
			await mockRedis.set('test:b', '2');
			await mockRedis.set('other:c', '3');

			await cache.clear();

			expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
			expect(mockRedis.del).toHaveBeenCalledWith('test:a', 'test:b');

			const other = await mockRedis.get('other:c');
			expect(other).toBe('3');
		});

		it('should do nothing if no keys match the prefix', async () => {
			await cache.clear();
			expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
			expect(mockRedis.del).not.toHaveBeenCalled();
		});
	});

	describe('prefix handling', () => {
		it('should use the key prefix for all operations', async () => {
			await cache.get('x');
			expect(mockRedis.get).toHaveBeenCalledWith('test:x');

			await cache.set('y', { value: 1, expiry: null });
			expect(mockRedis.set).toHaveBeenCalledWith(
				'test:y',
				JSON.stringify({ value: 1, expiry: null })
			);

			await cache.delete('z');
			expect(mockRedis.del).toHaveBeenCalledWith('test:z');

			await cache.clear();
			expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
		});
	});
});
