import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router';
import {
    cleanupUrl,
    clearAllAuthData,
    getLastOnlineAuthAt,
    getStoredAuthInfo,
    handleOAuthCallback,
    markOnlineAuth,
    refreshAccessToken,
    setActiveLoginId,
    setAccountType,
} from '@/external/deriv-core';
import ChunkLoader from '@/components/loader/chunk-loader';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { StoreProvider } from '@/hooks/useStore';
import { isPreviewMode, PREVIEW_BASE_PATH } from '@/utils/is-preview-mode';
import { localize, TranslationProvider } from '@deriv-com/translations';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import CoreStoreProvider from './CoreStoreProvider';
import i18nInstance from './i18n';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

const LanguageHandler = ({ children }: { children: React.ReactNode }) => {
    useLanguageFromURL();
    return <>{children}</>;
};

const routerBasename = isPreviewMode() ? PREVIEW_BASE_PATH : undefined;

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path='/'
            element={
                <Suspense
                    fallback={<ChunkLoader message={localize('Please wait while we connect to the server...')} />}
                >
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <LanguageHandler>
                            <StoreProvider>
                                <LocalStorageSyncWrapper>
                                    <RoutePromptDialog />
                                    <CoreStoreProvider>
                                        <Layout />
                                    </CoreStoreProvider>
                                </LocalStorageSyncWrapper>
                            </StoreProvider>
                        </LanguageHandler>
                    </TranslationProvider>
                </Suspense>
            }
        >
            <Route index element={<AppRoot />} />
            <Route path='preview' element={<AppRoot />} />
        </Route>
    ),
    { basename: routerBasename }
);

const OFFLINE_GRACE_MS = 20 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function getAuthConfig() {
    return {
        clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID || '',
        redirectUri: process.env.NEXT_PUBLIC_DERIV_REDIRECT_URL || '',
        scopes: process.env.NEXT_PUBLIC_DERIV_OAUTH_SCOPE || 'trade',
    };
}

async function refreshAuthenticatedSession(): Promise<void> {
    const { clientId } = getAuthConfig();
    if (!clientId) return;

    const storedAuth = getStoredAuthInfo();
    if (!storedAuth) return;

    let authInfo = storedAuth;
    const expiresAt = storedAuth.expires_at ? storedAuth.expires_at * 1000 : 0;

    if (storedAuth.refresh_token && (!expiresAt || expiresAt - Date.now() <= TOKEN_REFRESH_SKEW_MS)) {
        authInfo = await refreshAccessToken(storedAuth.refresh_token, clientId);
    }

    const accounts = await DerivWSAccountsService.fetchAccountsList(authInfo.access_token);
    if (!accounts.length) throw new Error('No Deriv trading accounts were returned');

    // Refresh account data, including balances, while preserving the user's
    // currently selected account whenever it still exists.
    const previousLoginId = localStorage.getItem('active_loginid');
    const selectedAccount =
        (previousLoginId && accounts.find(account => account.account_id === previousLoginId)) || accounts[0];

    setActiveLoginId(selectedAccount.account_id);
    setAccountType(selectedAccount.account_type);
    DerivWSAccountsService.storeAccounts(accounts);
    markOnlineAuth();

    const { api_base } = await import('@/external/bot-skeleton');
    await api_base.init(true);
}

function App() {
    useAccountSwitching();

    React.useEffect(() => {
        let disposed = false;
        let offlineTimer: ReturnType<typeof setInterval> | undefined;

        const enforceOfflineGrace = () => {
            const lastOnlineAuth = getLastOnlineAuthAt();
            if (lastOnlineAuth && Date.now() - lastOnlineAuth >= OFFLINE_GRACE_MS) {
                clearAllAuthData();
                if (!disposed) window.location.reload();
            }
        };

        const bootstrapSession = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('code')) return;

            const storedAuth = getStoredAuthInfo();
            if (!storedAuth) return;

            if (!navigator.onLine) {
                // Keep the existing session usable while offline for 20 minutes.
                // After that period the app requires a fresh Deriv login.
                if (!getLastOnlineAuthAt()) markOnlineAuth();
                enforceOfflineGrace();
                offlineTimer = setInterval(enforceOfflineGrace, 30 * 1000);
                return;
            }

            try {
                // Browser refresh stays logged in, but the online session is
                // revalidated and the latest Deriv balances are fetched.
                await refreshAuthenticatedSession();
            } catch (error) {
                console.error('[Auth] Session refresh failed:', error);
                // Transient network/API failure gets the offline grace period;
                // never log the user out merely because one request failed.
                if (!getLastOnlineAuthAt()) markOnlineAuth();
            }
        };

        const handleOnline = async () => {
            try {
                await refreshAuthenticatedSession();
            } catch (error) {
                console.error('[Auth] Reconnect/refresh failed:', error);
            }
        };

        void bootstrapSession();
        window.addEventListener('online', handleOnline);

        return () => {
            disposed = true;
            if (offlineTimer) clearInterval(offlineTimer);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('code')) return;

        const handleCallback = async () => {
            const { clientId, redirectUri, scopes } = getAuthConfig();

            if (!clientId || !redirectUri) {
                console.error('[OAuth] Callback cannot be completed: missing DERIV_APP_ID or DERIV_REDIRECT_URL');
                return;
            }

            try {
                const authInfo = await handleOAuthCallback(window.location.href, {
                    clientId,
                    redirectUri,
                    scopes,
                });

                const accounts = await DerivWSAccountsService.fetchAccountsList(authInfo.access_token);
                if (!accounts.length) {
                    throw new Error('No Deriv trading accounts were returned for the authenticated user');
                }

                const activeLoginId = localStorage.getItem('active_loginid');
                const selectedAccount =
                    (activeLoginId && accounts.find(account => account.account_id === activeLoginId)) || accounts[0];

                setActiveLoginId(selectedAccount.account_id);
                setAccountType(selectedAccount.account_type);
                DerivWSAccountsService.storeAccounts(accounts);
                markOnlineAuth();

                const { api_base } = await import('@/external/bot-skeleton');
                await api_base.init(true);
            } catch (error) {
                console.error('[OAuth] Callback/account connection failed:', error);
            } finally {
                cleanupUrl(redirectUri);
            }
        };

        void handleCallback();
    }, []);

    return <RouterProvider router={router} />;
}

export default App;
