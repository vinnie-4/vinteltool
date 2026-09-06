import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router';
import { cleanupUrl, handleOAuthCallback } from '@/external/deriv-core';
import ChunkLoader from '@/components/loader/chunk-loader';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { StoreProvider } from '@/hooks/useStore';
import { isPreviewMode, PREVIEW_BASE_PATH } from '@/utils/is-preview-mode';
import { localize, TranslationProvider } from '@deriv-com/translations';
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

function App() {
    useAccountSwitching();

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('code')) return;

        const handleCallback = async () => {
            // The current Deriv OAuth flow uses the registered application's
            // App ID as OAuth client_id. There is no separate OAuth client ID
            // required for this app.
            const clientId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
            const redirectUri = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URL;
            const scopes = process.env.NEXT_PUBLIC_DERIV_OAUTH_SCOPE || 'trade';

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

                const { DerivWSAccountsService } = await import('@/services/derivws-accounts.service');
                const accounts = await DerivWSAccountsService.fetchAccountsList(authInfo.access_token);

                if (!accounts || accounts.length === 0) {
                    throw new Error('No Deriv trading accounts were returned for the authenticated user');
                }

                DerivWSAccountsService.storeAccounts(accounts);

                const activeLoginId = localStorage.getItem('active_loginid');
                const selectedAccount =
                    (activeLoginId && accounts.find(account => account.account_id === activeLoginId)) || accounts[0];

                localStorage.setItem('active_loginid', selectedAccount.account_id);
                localStorage.setItem('account_type', selectedAccount.account_type);

                // api_base obtains the selected account's fresh authenticated WebSocket URL
                // through getSocketURL() → DerivWSAccountsService → account OTP endpoint.
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
