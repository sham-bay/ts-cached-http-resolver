/**
 * Checks whether a Response is ok (status 2xx).
 * If not, throws an error with the status and response body.
 *
 * @param response - The fetch Response object.
 * @param preMessage - A prefix for the error message.
 * @throws {Error} When response is not ok.
 */
export async function checkResponse(response: Response, preMessage: string): Promise<void> {
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${preMessage}: ${response.status} ${text}`);
	}
}
