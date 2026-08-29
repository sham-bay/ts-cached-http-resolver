import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from '../../src/cache/MemoryCache.js';
import type { CacheItem } from '../../src/types/CacheItem.js';

describe('MemoryCache', () => {
	let cache: MemoryCache;

	beforeEach(() => {
		cache = new MemoryCache();
	});

	describe('set / get', () => {
		it('should store and retrieve a value with null expiry', async () => {
			const item: CacheItem<number> = { value: 42, expiry: null };
			await cache.set('key', item);
			const result = await cache.get<number>('key');
			expect(result).toEqual(item);
		});

		it('should store and retrieve a value with a numeric expiry', async () => {
			const expiry = Date.now() + 10000;
			const item: CacheItem<string> = { value: 'test', expiry };
			await cache.set('key', item);
			const result = await cache.get<string>('key');
			expect(result).toEqual(item);
		});

		it('should return undefined for a missing key', async () => {
			const result = await cache.get('missing');
			expect(result).toBeUndefined();
		});

		it('should overwrite an existing key', async () => {
			await cache.set('key', { value: 'old', expiry: null });
			await cache.set('key', { value: 'new', expiry: null });
			const result = await cache.get<string>('key');
			expect(result?.value).toBe('new');
		});

		it('should store different data types', async () => {
			await cache.set('bool', { value: true, expiry: null });
			await cache.set('obj', { value: { nested: true }, expiry: null });
			await cache.set('arr', { value: [1, 2, 3], expiry: null });

			const bool = await cache.get<boolean>('bool');
			const obj = await cache.get<{ nested: boolean }>('obj');
			const arr = await cache.get<number[]>('arr');

			expect(bool?.value).toBe(true);
			expect(obj?.value).toEqual({ nested: true });
			expect(arr?.value).toEqual([1, 2, 3]);
		});
	});

	describe('delete', () => {
		it('should remove an existing key', async () => {
			await cache.set('key', { value: 42, expiry: null });
			await cache.delete('key');
			const result = await cache.get('key');
			expect(result).toBeUndefined();
		});

		it('should not throw when deleting a non‑existent key', async () => {
			await expect(cache.delete('missing')).resolves.not.toThrow();
		});
	});

	describe('clear', () => {
		it('should remove all keys', async () => {
			await cache.set('a', { value: 1, expiry: null });
			await cache.set('b', { value: 2, expiry: null });
			await cache.clear();
			const a = await cache.get('a');
			const b = await cache.get('b');
			expect(a).toBeUndefined();
			expect(b).toBeUndefined();
		});

		it('should do nothing on an empty cache', async () => {
			await expect(cache.clear()).resolves.not.toThrow();
		});
	});

	describe('entries', () => {
		it('should return all entries as key‑value pairs', async () => {
			await cache.set('a', { value: 1, expiry: null });
			await cache.set('b', { value: 2, expiry: Date.now() + 1000 });
			const entries = await cache.entries();
			expect(entries).toHaveLength(2);
			expect(entries).toEqual(
				expect.arrayContaining([
					['a', { value: 1, expiry: null }],
					['b', { value: 2, expiry: expect.any(Number) }]
				])
			);
		});

		it('should return an empty array when cache is empty', async () => {
			const entries = await cache.entries();
			expect(entries).toEqual([]);
		});
	});

	describe('behaviour – no automatic expiration', () => {
		it('should not remove entries with expired expiry (caller must handle)', async () => {
			const expiredItem: CacheItem<number> = { value: 42, expiry: Date.now() - 1000 };
			await cache.set('expired', expiredItem);
			const stored = await cache.get<number>('expired');
			// MemoryCache itself does not check expiry – it returns the item as is.
			expect(stored).toEqual(expiredItem);
		});
	});
});
