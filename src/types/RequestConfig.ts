import type { RetryOptions } from './RetryOptions.js';

/**
 * Configuration for a single request.
 */
export interface RequestConfig {
	// ---- Caching ----

	/**
	 * Key used to store/retrieve the response from cache.
	 * If omitted, caching is disabled for this request.
	 */
	cacheKey?: string;

	/**
	 * Static TTL (in seconds). Ignored if `ttlResolver` is also provided.
	 */
	cacheTTL?: number;

	/**
	 * Dynamic TTL resolver – receives the response data and returns TTL in seconds.
	 * Takes precedence over `cacheTTL`.
	 */
	ttlResolver?: (data: unknown) => number | null;

	/**
	 * Time (in seconds) before the actual expiry when a refresh should be triggered.
	 */
	refreshBufferSeconds?: number;

	// ---- Deduplication ----

	/**
	 * Key used to deduplicate concurrent requests.
	 * If omitted but `cacheKey` is set, `cacheKey` is used.
	 */
	requestKey?: string;

	// ---- Hooks ----

	/**
	 * Called before the actual fetch.
	 */
	onBefore?: (url: string, options: RequestInit) => void | Promise<void>;

	/**
	 * Called after a successful fetch (response received and parsed).
	 */
	onAfter?: (response: Response, data: unknown) => void | Promise<void>;

	/**
	 * Called on each retry attempt (including the final failure).
	 * Receives the error and the attempt number (1‑based).
	 */
	onError?: (error: Error, attempt: number) => void | Promise<void>;

	// ---- Retries ----

	/**
	 * Override default retry options for this request.
	 */
	retryOptions?: RetryOptions;
}
