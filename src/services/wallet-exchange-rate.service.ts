/**
 * VintelTool Wallet Exchange Rate service.
 *
 * Uses Deriv's authenticated Wallet REST API to quote KES <-> USD.
 * Deriv requires the OAuth "payment" scope for this endpoint.
 */

const WALLET_API_BASE = 'https://api.derivws.com';

export type WalletExchangeRateResponse = {
    data?: {
        exchange_rate?: string;
        rate_token?: string;
    };
    errors?: Array<{
        status?: number;
        code?: string;
        message?: string;
        field?: string;
    }>;
};

export type WalletExchangeQuote = {
    sourceCurrency: string;
    destinationCurrency: string;
    exchangeRate: number;
    rateToken: string;
};

const getHeaders = (accessToken: string, appId?: string): Record<string, string> => {
    if (!accessToken) throw new Error('Deriv access token is required.');

    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
    };

    // Only needed for PAT authentication. OAuth bearer tokens do not require it.
    if (appId) headers['Deriv-App-ID'] = appId;

    return headers;
};

export const getWalletExchangeRate = async (
    sourceCurrency: string,
    destinationCurrency: string,
    accessToken: string,
    appId?: string
): Promise<WalletExchangeQuote> => {
    const source = sourceCurrency.trim().toUpperCase();
    const destination = destinationCurrency.trim().toUpperCase();

    if (!source || !destination) {
        throw new Error('Source and destination currencies are required.');
    }

    const params = new URLSearchParams({
        source_currency: source,
        destination_currency: destination,
    });

    const response = await fetch(
        `${WALLET_API_BASE}/wallet/v1/exchange-rate?${params.toString()}`,
        {
            method: 'GET',
            headers: getHeaders(accessToken, appId),
        }
    );

    const body = (await response.json()) as WalletExchangeRateResponse;

    if (!response.ok) {
        const error = body.errors?.[0];
        throw new Error(
            error?.message ||
                `Unable to get ${source}/${destination} exchange rate (HTTP ${response.status}).`
        );
    }

    const exchangeRate = Number(body.data?.exchange_rate);
    const rateToken = body.data?.rate_token;

    if (!Number.isFinite(exchangeRate) || !rateToken) {
        throw new Error('Deriv returned an invalid exchange-rate quote.');
    }

    return {
        sourceCurrency: source,
        destinationCurrency: destination,
        exchangeRate,
        rateToken,
    };
};

export const quoteKesToUsd = (accessToken: string, appId?: string) =>
    getWalletExchangeRate('KES', 'USD', accessToken, appId);

export const quoteUsdToKes = (accessToken: string, appId?: string) =>
    getWalletExchangeRate('USD', 'KES', accessToken, appId);

export const convertWithExchangeRate = (
    amount: number,
    quote: WalletExchangeQuote
): number => {
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Amount must be a non-negative number.');
    }

    return amount * quote.exchangeRate;
};
