import {
    buildAuthorizationUrl,
    buildSignUpUrl,
    getAuthInfo,
    parseReferralLink,
    parseLandingParams,
    resolveReferralViaProxy,
} from '@/external/deriv-core';
import type { AuthConfig } from '@/external/deriv-core';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import brandConfig from '../../../../../brand.config.json';

export const PRODUCTION_DOMAINS = {
    COM: brandConfig.platform.hostname.production.com,
} as const;

export const STAGING_DOMAINS = {
    COM: brandConfig.platform.hostname.staging.com,
} as const;

export const WS_SERVERS = {
    STAGING: `${brandConfig.platform.derivws.url.staging}options/ws/public`,
    PRODUCTION: `${brandConfig.platform.derivws.url.production}options/ws/public`,
} as const;

export const isProduction = () => {
    const env = process.env.NEXT_PUBLIC_DERIV_ENV;
    if (env === 'production') return true;
    if (env === 'preview' || env === 'staging') return false;

    const hostname = window.location.hostname;
    const productionDomains = Object.values(PRODUCTION_DOMAINS) as string[];
    return productionDomains.includes(hostname);
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const isProductionEnv = isProduction();
    return isProductionEnv ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;
};

/**
 * Returns the public market-data socket when logged out, and the one-time
 * authenticated Deriv socket when logged in. Authentication failures are
 * deliberately propagated instead of silently falling back to a public socket,
 * because a public socket cannot place trades.
 */
export const getSocketURL = async (): Promise<string> => {
    const authInfo = getAuthInfo();

    if (!authInfo?.access_token) {
        return getDefaultServerURL();
    }

    const wsUrl = await DerivWSAccountsService.getAuthenticatedWebSocketURL(authInfo.access_token);
    if (!wsUrl) {
        throw new Error('Deriv did not return an authenticated trading WebSocket URL.');
    }

    return wsUrl;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = async (prompt?: string): Promise<string> => {
    try {
        const clientId = process.env.NEXT_PUBLIC_DERIV_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_DERIV_APP_ID;
        const redirectUri = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URL;
        const scopes = process.env.NEXT_PUBLIC_DERIV_OAUTH_SCOPE || 'trade';

        if (!clientId || !redirectUri) {
            console.error('[OAuth] Missing DERIV_OAUTH_CLIENT_ID/DERIV_APP_ID or DERIV_REDIRECT_URL');
            return '';
        }

        const config: AuthConfig = { clientId, redirectUri, scopes };

        const referralLink = process.env.NEXT_PUBLIC_DERIV_REFERRAL_LINK;
        if (referralLink) {
            const referral = parseReferralLink(referralLink);
            if (referral) {
                config.affiliateToken = referral.affiliateToken;
                config.affiliateTokenParam = referral.affiliateTokenParam;
                config.utmCampaign = referral.utmCampaign;
                if (referral.utmSource) config.utmSource = referral.utmSource;
                if (referral.utmMedium) config.utmMedium = referral.utmMedium;
            }
        }

        const landing = parseLandingParams();
        if (landing) {
            if (landing.affiliateToken) {
                config.affiliateToken = landing.affiliateToken;
                config.affiliateTokenParam = landing.affiliateTokenParam;
            }
            if (landing.utmSource) config.utmSource = landing.utmSource;
            if (landing.utmMedium) config.utmMedium = landing.utmMedium;
            if (landing.utmCampaign) config.utmCampaign = landing.utmCampaign;
        }

        if (!config.affiliateToken && referralLink) {
            const resolved = await resolveReferralViaProxy(referralLink);
            if (resolved) {
                config.affiliateToken = resolved.affiliateToken;
                config.affiliateTokenParam = resolved.affiliateTokenParam;
                if (resolved.utmSource) config.utmSource = resolved.utmSource;
                if (resolved.utmMedium) config.utmMedium = resolved.utmMedium;
                if (resolved.utmCampaign) config.utmCampaign = resolved.utmCampaign;
            }
        }

        return prompt === 'registration' ? await buildSignUpUrl(config) : await buildAuthorizationUrl(config);
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
        return '';
    }
};
