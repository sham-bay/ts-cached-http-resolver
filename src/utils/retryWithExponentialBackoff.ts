/**
 * Executes an asynchronous operation with retries and exponential backoff.
 *
 * @param operation - The async function to execute.
 * @param maxRetries - Maximum number of retry attempts.
 * @param baseDelay - Base delay in milliseconds.
 * @param useExponential - If true, delay multiplies by 2 each attempt.
 * @param onError - Optional hook called on each failure (attempt is 1‑based).
 * @returns The operation's result.
 * @throws The last error after all retries fail.
 */
export async function retryWithExponentialBackoff<T>(
	operation: () => Promise<T>,
	maxRetries: number,
	baseDelay: number,
	useExponential: boolean,
	onError?: (error: Error, attempt: number) => void | Promise<void>
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (onError) {
				await onError(lastError, attempt + 1);
			}
			if (attempt === maxRetries - 1) break;

			const delay = useExponential ? baseDelay * Math.pow(2, attempt) : baseDelay;
			console.warn(
				`[retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw new Error(
		`Operation failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'unknown'}`
	);
}
