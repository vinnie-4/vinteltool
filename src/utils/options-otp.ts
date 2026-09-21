/**
 * Deriv Options WebSocket OTP helper.
 *
 * Options OTPs are issued by the REST API and are:
 * - valid for 120 seconds
 * - single-use
 * - returned as a ready-to-connect WebSocket URL
 *
 * The OTP itself is deliberately not persisted. Keep the returned URL
 * in memory only and consume it immediately.
 */

const OPTIONS_API_BASE = 'https://api.derivws.com';
export const OPTIONS_OTP_LIFETIME_MS = 120_000;

export type OptionsOtpResponse = {
    data?: {
        url?: string;
    };
    errors?: Array<{
        status?: number;
        code?: string;
        message?: string;
    }>;
};

export const requestOptionsWebSocketUrl = async (
    accountId: string,
    accessToken: string,
    appId?: string
): Promise<string> => {
    if (!accountId) throw new Error('Options account ID is required.');
    if (!accessToken) throw new Error('Deriv access token is required.');

    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
    };

    // Deriv-App-ID is required for PAT authentication. OAuth bearer
    // authentication does not require this header, but accepting it here
    // keeps the helper usable for both authentication modes.
    if (appId) headers['Deriv-App-ID'] = appId;

    const response = await fetch(
        `${OPTIONS_API_BASE}/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
        {
            method: 'POST',
            headers,
        }
    );

    const body = (await response.json()) as OptionsOtpResponse;

    if (!response.ok) {
        const error = body.errors?.[0];
        throw new Error(
            error?.message ||
                `Failed to generate Options WebSocket OTP (HTTP ${response.status}).`
        );
    }

    const url = body.data?.url;
    if (!url) {
        throw new Error('Deriv Options OTP response did not contain a WebSocket URL.');
    }

    return url;
};

/**
 * Opens an authenticated Options WebSocket using a freshly issued OTP URL.
 *
 * Do not persist or reuse the URL after the connection attempt: the embedded
 * OTP is single-use and expires after 120 seconds.
 */
export const connectOptionsWebSocket = async (
    accountId: string,
    accessToken: string,
    appId?: string
): Promise<WebSocket> => {
    const url = await requestOptionsWebSocketUrl(accountId, accessToken, appId);
    return new WebSocket(url);
};
