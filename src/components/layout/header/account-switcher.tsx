import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { addComma, getCurrencyDisplayCode, getDecimalPlaces } from '@/components/shared';
import { CurrencyIcon } from '@/components/currency/currency-icon';
import Text from '@/components/shared_ui/text';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { isDemoAccount } from '@/utils/account-helpers';
import { Localize } from '@deriv-com/translations';
import { TAccountSwitcher } from './common/types';
import AccountInfoWrapper from './account-info-wrapper';
import './account-switcher.scss';

const getNewApiAccountType = (account: unknown, loginid?: string): 'demo' | 'real' => {
    const data = (account ?? {}) as Record<string, unknown>;
    const type = String(
        data.account_type ?? data.accountType ?? data.account_category ?? data.environment ?? data.type ?? ''
    ).toLowerCase();

    if (
        data.is_virtual === true ||
        data.isVirtual === true ||
        data.is_demo === true ||
        data.isDemo === true ||
        type === 'demo' ||
        type === 'virtual' ||
        type === 'demo_account'
    )
        return 'demo';
    if (type === 'real' || type === 'real_account') return 'real';

    return isDemoAccount(loginid ?? '') ? 'demo' : 'real';
};

const AccountSwitcher = observer(({ activeAccount, onLogout }: TAccountSwitcher & { onLogout?: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<'demo' | 'real' | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { accountList, activeLoginid } = useApiBase();
    const { client, run_panel } = useStore() ?? {};

    const is_bot_running = run_panel?.is_running || api_base.is_running;
    const isSingleAccount = !accountList || accountList.length <= 1;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const toggleDropdown = useCallback(() => {
        if (is_bot_running || isSingleAccount) return;
        setSelectedTab(getNewApiAccountType(activeAccount, activeLoginid));
        setIsOpen(prev => !prev);
    }, [activeAccount, activeLoginid, isSingleAccount, is_bot_running]);

    const handleAccountSelect = useCallback(
        (loginid: string) => {
            if (loginid === activeLoginid) {
                setIsOpen(false);
                return;
            }
            localStorage.setItem('active_loginid', loginid);
            client?.checkAndRegenerateWebSocket();
            setIsOpen(false);
        },
        [activeLoginid, client]
    );

    const formattedAccounts = useMemo(() => {
        if (!accountList) return [];
        return accountList
            .map(account => {
                const accountType = getNewApiAccountType(account, account.loginid);
                return {
                    loginid: account.loginid,
                    currency: account.currency,
                    balance: addComma(Number(account.balance ?? 0).toFixed(getDecimalPlaces(account.currency))),
                    isVirtual: accountType === 'demo',
                    isActive: account.loginid === activeLoginid,
                };
            })
            .sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
    }, [accountList, activeLoginid]);

    if (!activeAccount) return null;

    const { currency, balance } = activeAccount;
    const isVirtual = getNewApiAccountType(activeAccount, activeLoginid) === 'demo';
    const showChevron = !isSingleAccount && !is_bot_running;
    const activeTab: 'demo' | 'real' = selectedTab ?? (isVirtual ? 'demo' : 'real');
    const visibleAccounts = formattedAccounts.filter(account =>
        activeTab === 'demo' ? account.isVirtual : !account.isVirtual
    );

    return (
        <div className='acc-info__wrapper' ref={wrapperRef}>
            <AccountInfoWrapper>
                <div
                    data-testid='dt_acc_info'
                    id='dt_core_account-info_acc-info'
                    role={showChevron ? 'button' : undefined}
                    tabIndex={showChevron ? 0 : -1}
                    aria-expanded={showChevron ? isOpen : undefined}
                    aria-haspopup={showChevron ? 'dialog' : undefined}
                    className={classNames('acc-info', {
                        'acc-info--is-virtual': isVirtual,
                        'acc-info--interactive': showChevron,
                    })}
                    onClick={toggleDropdown}
                    onKeyDown={e => {
                        if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleDropdown();
                        }
                    }}
                >
                    <span className='acc-info__id' aria-hidden='true'>
                        <CurrencyIcon currency={currency?.toLowerCase()} isVirtual={isVirtual} />
                    </span>
                    <div className='acc-info__content'>
                        <div className='acc-info__balance-section'>
                            <p data-testid='dt_balance' className='acc-info__balance'>
                                {!currency ? (
                                    <Localize i18n_default_text='No currency assigned' />
                                ) : (
                                    `${balance} ${getCurrencyDisplayCode(currency)}`
                                )}
                            </p>
                            {showChevron && (
                                <span className={classNames('acc-info__select-arrow', { 'acc-info__select-arrow--invert': isOpen })} aria-hidden='true'>
                                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                                        <path d='M2 4L6 8L10 4' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                                    </svg>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </AccountInfoWrapper>

            {isOpen && (
                <div className='acc-modal-backdrop' role='presentation' onMouseDown={e => e.stopPropagation()}>
                    <div className='acc-modal' role='dialog' aria-modal='true' aria-label='Accounts'>
                        <div className='acc-modal__tabs' role='tablist' aria-label='Account type'>
                            <button type='button' role='tab' aria-selected={activeTab === 'real'} className={classNames('acc-modal__tab', { 'acc-modal__tab--active': activeTab === 'real' })} style={{ background: '#fff', color: '#000' }} onClick={() => setSelectedTab('real')}>Real</button>
                            <button type='button' role='tab' aria-selected={activeTab === 'demo'} className={classNames('acc-modal__tab', { 'acc-modal__tab--active': activeTab === 'demo' })} style={{ background: '#fff', color: '#000' }} onClick={() => setSelectedTab('demo')}>Demo</button>
                        </div>

                        <div className='acc-modal__section-header'>
                            <Text size='xs' className='acc-modal__section-title'>{activeTab === 'demo' ? 'Deriv account' : 'Deriv accounts'}</Text>
                            <button type='button' className='acc-modal__collapse' aria-label='Close accounts' onClick={() => setIsOpen(false)}>
                                <svg width='18' height='18' viewBox='0 0 18 18' fill='none' aria-hidden='true'><path d='M5 11L9 7L13 11' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' /></svg>
                            </button>
                        </div>

                        <div className='acc-modal__accounts' role='listbox'>
                            {visibleAccounts.map(account => (
                                <button type='button' key={account.loginid} role='option' aria-selected={account.isActive} className={classNames('acc-modal__account', { 'acc-modal__account--selected': account.isActive })} style={{ background: '#fff', color: '#000' }} onClick={() => handleAccountSelect(account.loginid)}>
                                    <span className='acc-modal__icon' aria-hidden='true'><CurrencyIcon currency={account.currency?.toLowerCase()} isVirtual={account.isVirtual} /></span>
                                    <span className='acc-modal__details'><span className='acc-modal__account-name'>{activeTab === 'demo' ? 'Demo' : getCurrencyDisplayCode(account.currency)}</span><span className='acc-modal__loginid'>{account.loginid}</span></span>
                                    <span className='acc-modal__balance'>{account.currency ? `${account.balance} ${getCurrencyDisplayCode(account.currency)}` : 'No currency'}</span>
                                    {account.isActive && <span className='acc-modal__check' aria-label='Selected'>✓</span>}
                                </button>
                            ))}
                        </div>

                        <div className='acc-modal__trader-hub'>Looking for CFD accounts? Go to Trader's Hub</div>

                        <button
                            type='button'
                            className='acc-modal__logout'
                            style={{ width: '100%', minHeight: '72px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '0 32px', border: 0, borderTop: '4px solid #f4f4f4', borderRadius: 0, background: '#fff', color: '#000', fontSize: '15px', fontWeight: 400, textAlign: 'right', cursor: 'pointer' }}
                            onClick={() => {
                                setIsOpen(false);
                                onLogout?.();
                            }}
                        >
                            <span>Logout</span>
                            <svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true'>
                                <path d='M8 4H4.8C4.36 4 4 4.36 4 4.8V15.2C4 15.64 4.36 16 4.8 16H8' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
                                <path d='M11 6L15 10L11 14' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                                <path d='M7 10H15' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default AccountSwitcher;
