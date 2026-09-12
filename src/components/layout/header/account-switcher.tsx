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
    const type = String(data.account_type ?? data.accountType ?? data.account_category ?? data.environment ?? data.type ?? '').toLowerCase();

    if (data.is_virtual === true || data.isVirtual === true || data.is_demo === true || data.isDemo === true || type === 'demo' || type === 'virtual' || type === 'demo_account') return 'demo';
    if (type === 'real' || type === 'real_account') return 'real';

    return isDemoAccount(loginid ?? '') ? 'demo' : 'real';
};

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const [isOpen, setIsOpen] = useState(false);
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
        setIsOpen(prev => !prev);
    }, [is_bot_running, isSingleAccount]);

    const handleAccountSelect = useCallback((loginid: string) => {
        if (loginid === activeLoginid) {
            setIsOpen(false);
            return;
        }
        localStorage.setItem('active_loginid', loginid);
        client?.checkAndRegenerateWebSocket();
        setIsOpen(false);
    }, [activeLoginid, client]);

    const formattedAccounts = useMemo(() => {
        if (!accountList) return [];
        return accountList.map(account => {
            const accountType = getNewApiAccountType(account, account.loginid);
            return {
                loginid: account.loginid,
                currency: account.currency,
                balance: addComma(Number(account.balance ?? 0).toFixed(getDecimalPlaces(account.currency))),
                isVirtual: accountType === 'demo',
                isActive: account.loginid === activeLoginid,
            };
        }).sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
    }, [accountList, activeLoginid]);

    if (!activeAccount) return null;

    const { currency, balance } = activeAccount;
    const isVirtual = getNewApiAccountType(activeAccount, activeLoginid) === 'demo';
    const showChevron = !isSingleAccount && !is_bot_running;
    const accountLabel = isVirtual ? 'Demo' : 'Real';

    return (
        <div className='acc-info__wrapper' ref={wrapperRef}>
            <AccountInfoWrapper>
                <div data-testid='dt_acc_info' id='dt_core_account-info_acc-info' role={showChevron ? 'button' : undefined} tabIndex={showChevron ? 0 : -1} aria-expanded={showChevron ? isOpen : undefined} aria-haspopup={showChevron ? 'listbox' : undefined} className={classNames('acc-info', { 'acc-info--is-virtual': isVirtual, 'acc-info--interactive': showChevron })} onClick={toggleDropdown} onKeyDown={e => {
                    if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggleDropdown();
                    }
                }}>
                    <span className='acc-info__id' aria-hidden='true'><CurrencyIcon currency={currency?.toLowerCase()} isVirtual={isVirtual} /></span>
                    <div className='acc-info__content'>
                        <div className='acc-info__account-type-header'>
                            <Text as='p' size='xs' className='acc-info__account-type'>{accountLabel}</Text>
                            {showChevron && <span className={classNames('acc-info__select-arrow', { 'acc-info__select-arrow--invert': isOpen })}>
                                <svg width='12' height='12' viewBox='0 0 12 12' fill='none'><path d='M2 4L6 8L10 4' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' /></svg>
                            </span>}
                        </div>
                        <div className='acc-info__balance-section'><p data-testid='dt_balance' className='acc-info__balance'>{!currency ? <Localize i18n_default_text='No currency assigned' /> : `${balance} ${getCurrencyDisplayCode(currency)}`}</p></div>
                    </div>
                </div>
            </AccountInfoWrapper>
            {isOpen && <div className='acc-dropdown' role='listbox'>
                <div className='acc-dropdown__header'><Text size='xxs' className='acc-dropdown__title'>Accounts</Text><Text size='xxxs' className='acc-dropdown__status'>Deriv API</Text></div>
                {formattedAccounts.map(account => <div key={account.loginid} role='option' aria-selected={account.isActive} tabIndex={0} className={classNames('acc-dropdown__account', { 'acc-dropdown__account--selected': account.isActive })} onClick={() => handleAccountSelect(account.loginid)} onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAccountSelect(account.loginid);
                    }
                }}>
                    <span className='acc-dropdown__icon' aria-hidden='true'><CurrencyIcon currency={account.currency?.toLowerCase()} isVirtual={account.isVirtual} /></span>
                    <span className='acc-dropdown__details'><span className={classNames('acc-dropdown__account-type', { 'acc-dropdown__account-type--virtual': account.isVirtual })}>{account.isVirtual ? 'Demo account' : 'Real account'}</span><span className='acc-dropdown__loginid'>{account.loginid}</span></span>
                    <span className='acc-dropdown__balance'>{account.currency ? `${account.balance} ${getCurrencyDisplayCode(account.currency)}` : 'No currency'}</span>
                    {account.isActive && <span className='acc-dropdown__check' aria-label='Selected'>✓</span>}
                </div>)}
            </div>}
        </div>
    );
});

export default AccountSwitcher;
