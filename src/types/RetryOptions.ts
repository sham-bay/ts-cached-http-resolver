/**
 * Options for retry logic.
 */
export interface RetryOptions {
	/**
	 * Maximum number of retry attempts.
	 */
	maxRetries?: number;

	/**
	 * Base delay between retries (in milliseconds).
	 */
	baseDelay?: number;

	/**
	 * Whether to use exponential backoff (delay = baseDelay * 2^attempt).
	 */
	useExponential?: boolean;
}
