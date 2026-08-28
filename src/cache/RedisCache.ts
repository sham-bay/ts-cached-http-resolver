import Redis from 'ioredis';
import type { CacheStore } from './CacheStore';
import type { CacheItem } from '../types';

/**
 * Configuration for the Redis cache store.
 */
export interface RedisCacheOptions {
	/**
	 * Either an existing Redis instance or connection options.
	 */
	redis: Redis | { host?: string; port?: number; password?: string; db?: number };

	/**
	 * Optional prefix applied to all keys (e.g. `'myapp:'`).
	 */
	keyPrefix?: string;
}

/**
 * Redis‑backed cache store.
 * Automatically sets Redis TTL based on the item's expiry.
 */
export class RedisCache implements CacheStore {
	private client: Redis;
	private prefix: string;

	constructor(options: RedisCacheOptions) {
		this.client = options.redis instanceof Redis ? options.redis : new Redis(options.redis);
		this.prefix = options.keyPrefix ?? '';
	}

	private buildKey(key: string): string {
		return this.prefix + key;
	}

	/** @inheritdoc */
	async get<T>(key: string): Promise<CacheItem<T> | undefined> {
		const raw = await this.client.get(this.buildKey(key));
		if (!raw) return undefined;
		try {
			return JSON.parse(raw) as CacheItem<T>;
		} catch {
			return undefined;
		}
	}

	/** @inheritdoc */
	async set<T>(key: string, item: CacheItem<T>): Promise<void> {
		const serialized = JSON.stringify(item);
		const fullKey = this.buildKey(key);
		if (item.expiry !== null) {
			const ttlSeconds = Math.max(1, Math.floor((item.expiry - Date.now()) / 1000));
			await this.client.set(fullKey, serialized, 'EX', ttlSeconds);
		} else {
			await this.client.set(fullKey, serialized);
		}
	}

	/** @inheritdoc */
	async delete(key: string): Promise<void> {
		await this.client.del(this.buildKey(key));
	}

	/** @inheritdoc */
	async clear(): Promise<void> {
		const pattern = this.buildKey('*');
		const keys = await this.client.keys(pattern);
		if (keys.length) {
			await this.client.del(...keys);
		}
	}
}
