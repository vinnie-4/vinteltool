import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { isExecutionPaused, waitForExecutionResume } from '../execution/pause-controller';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let delayIndex = 0;
let purchase_reference;
const ANALYSIS_SETTINGS_KEY = 'vinteltool-analysis-recovery-settings';
const readAnalysisSettings = () => {
    try {
        if (typeof window === 'undefined') return null;
        const value = JSON.parse(window.localStorage.getItem(ANALYSIS_SETTINGS_KEY) || 'null');
        return value && value.enabled ? value : null;
    } catch { return null; }
};
const getDigitClass = (digit, mode) => mode === 'over-under' ? (digit > 4 ? 'over' : 'under') : (digit % 2 === 0 ? 'even' : 'odd');
const contractMatchesSignal = (contractType, tradeOptions, mode, signal) => {
    const type = String(contractType || '').toUpperCase();
    if (mode === 'even-odd') return (signal === 'even' && type === 'DIGITEVEN') || (signal === 'odd' && type === 'DIGITODD');
    const barrier = Number(tradeOptions?.barrier);
    return (signal === 'over' && type === 'DIGITOVER' && (!Number.isFinite(barrier) || barrier === 4)) || (signal === 'under' && type === 'DIGITUNDER' && (!Number.isFinite(barrier) || barrier === 5));
};


export default Engine =>
    class Purchase extends Engine {
        async waitForAnalysisSignal(contract_type) {
            const settings = readAnalysisSettings();
            const type = String(contract_type || '').toUpperCase();
            if (!settings || settings.mode === 'even-trade' || !this.symbol || !['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER'].includes(type)) return true;
            const mode = settings.mode === 'over-under' ? 'over-under' : 'even-odd';
            const isEvenOddType = type === 'DIGITEVEN' || type === 'DIGITODD';
            const isOverUnderType = type === 'DIGITOVER' || type === 'DIGITUNDER';
            if ((mode === 'even-odd' && !isEvenOddType) || (mode === 'over-under' && !isOverUnderType)) return true;
            const streakLength = Math.max(2, Math.min(10, Number(settings.streak) || 3));
            const checkSignal = async () => {
                const digits = await this.getLastDigitList();
                if (!Array.isArray(digits) || digits.length < streakLength) return false;
                const recent = digits.slice(-streakLength);
                const firstClass = getDigitClass(Number(recent[0]), mode);
                if (!recent.every(digit => getDigitClass(Number(digit), mode) === firstClass)) return false;
                const opposite = mode === 'over-under' ? (firstClass === 'over' ? 'under' : 'over') : (firstClass === 'even' ? 'odd' : 'even');
                return contractMatchesSignal(contract_type, this.tradeOptions, mode, opposite);
            };
            if (await checkSignal()) return true;
            return new Promise(resolve => {
                let finished = false;
                let previousTick = this.store.getState().newTick;
                let unsubscribe;
                const finish = value => { if (finished) return; finished = true; unsubscribe?.(); resolve(value); };
                unsubscribe = this.store.subscribe(() => {
                    const state = this.store.getState();
                    if (state.scope === 'STOP') { finish(false); return; }
                    if (state.newTick === previousTick) return;
                    previousTick = state.newTick;
                    checkSignal().then(matched => { if (matched) finish(true); }).catch(() => {});
                });
            });
        }

        async waitForRecoveryContractType(contract_type) {
            const settings = readAnalysisSettings();
            if (!settings?.enabled || !settings?.recovery || !settings?.recoveryOnlyAfterLoss) return contract_type;
            if (settings.mode === 'even-trade' && !this.analysisRecoveryPending) {
                // After the one Even recovery purchase settles, resume the configured
                // primary Over/Under contract even if Blockly still selects its recovery branch.
                const primaryType = String(settings.primaryContractType || '').toUpperCase();
                if (String(contract_type || '').toUpperCase() === 'DIGITEVEN' &&
                    ['DIGITOVER', 'DIGITUNDER'].includes(primaryType)) {
                    this.analysisRecoveryTradeInProgress = false;
                    return primaryType;
                }
                return contract_type;
            }
            if (!this.analysisRecoveryPending) return contract_type;
            if (settings.mode === 'even-trade') {
                // Recovery is contract-based, not digit-filtered: after a loss,
                // keep purchasing Digit Even until a recovery contract wins.
                this.analysisRecoveryPending = false;
                this.analysisRecoveryTradeInProgress = true;
                try {
                    window.localStorage.setItem('vinteltool-analysis-win-beep-eligible', 'true');
                    window.localStorage.removeItem('vinteltool-recovery-analysis-state');
                } catch {}
                return 'DIGITEVEN';
            }
            const streakLength = Math.max(2, Math.min(30, Number(settings.streak) || 2));
            const checkStreak = async () => {
                const digits = await this.getLastDigitList();
                if (!Array.isArray(digits) || digits.length < streakLength) return null;
                const recent = digits.slice(-streakLength).map(Number);
                if (!recent.every(digit => Number.isInteger(digit) && digit >= 0 && digit <= 9)) return null;
                const allOdd = recent.every(digit => digit % 2 === 1);
                const allEven = recent.every(digit => digit % 2 === 0);
                if (allOdd) return 'DIGITEVEN';
                if (allEven) return 'DIGITODD';
                return null;
            };
            const matched = await checkStreak();
            if (matched) {
                this.analysisRecoveryPending = false;
                this.analysisRecoveryTradeInProgress = true;
                try {
                    window.localStorage.setItem('vinteltool-analysis-win-beep-eligible', 'true');
                    window.localStorage.removeItem('vinteltool-recovery-analysis-state');
                } catch {}
                return matched;
            }
            return new Promise(resolve => {
                let finished = false;
                let previousTick = this.store.getState().newTick;
                let unsubscribe;
                const finish = value => { if (finished) return; finished = true; unsubscribe?.(); resolve(value); };
                unsubscribe = this.store.subscribe(() => {
                    const state = this.store.getState();
                    if (state.scope === 'STOP') { finish(null); return; }
                    if (state.newTick === previousTick) return;
                    previousTick = state.newTick;
                    checkStreak().then(type => { if (type) { this.analysisRecoveryPending = false; this.analysisRecoveryTradeInProgress = true; try { window.localStorage.setItem('vinteltool-analysis-win-beep-eligible', 'true'); window.localStorage.removeItem('vinteltool-recovery-analysis-state'); } catch {} finish(type); } }).catch(() => {});
                });
            });
        }
        async purchase(contract_type) {
            // After a loss, optionally switch this scanner's next recovery trade to Even/Odd
            // once the configured number of consecutive live digits agrees on parity.
            const recoveryContractType = await this.waitForRecoveryContractType(contract_type);
            if (!recoveryContractType) return Promise.resolve();
            contract_type = recoveryContractType;
            // Analysis mode waits for the configured live streak before allowing the opposite-side digit contract.
            if (!(await this.waitForAnalysisSignal(contract_type))) return Promise.resolve();
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            // If execution is paused, only the first pending purchase may wait for
            // Resume. Additional callers must not continue, preventing Resume from
            // releasing multiple queued purchase attempts at once.
            if (isExecutionPaused()) {
                if (this.__vinteltool_pause_purchase_waiting) return Promise.resolve();
                this.__vinteltool_pause_purchase_waiting = true;
                try {
                    await waitForExecutionResume();
                } finally {
                    this.__vinteltool_pause_purchase_waiting = false;
                }
            }

            // Re-check the purchase scope after a pause so Resume cannot submit a
            // duplicate purchase if another execution path already advanced state.
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            const onSuccess = response => {
                // Don't unnecessarily send a forget request for a purchased contract.
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
                    this.renewProposalsOnPurchase();
                }

                delayIndex = 0;
                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            if (this.is_proposal_subscription_required && !this.analysisRecoveryTradeInProgress) {
                const { id, askPrice } = this.selectProposal(contract_type);

                const action = () => api_base.api.send({ buy: id, price: askPrice });

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                if (!this.options.timeMachineEnabled) {
                    return doUntilDone(action).then(onSuccess);
                }

                return recoverFromError(
                    action,
                    (errorCode, makeDelay) => {
                        // if disconnected no need to resubscription (handled by live-api)
                        if (errorCode !== 'DisconnectError') {
                            this.renewProposalsOnPurchase();
                        } else {
                            this.clearProposals();
                        }

                        const unsubscribe = this.store.subscribe(() => {
                            const { scope, proposalsReady } = this.store.getState();
                            if (scope === BEFORE_PURCHASE && proposalsReady) {
                                makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                                unsubscribe();
                            }
                        });
                    },
                    ['PriceMoved', 'InvalidContractProposal'],
                    delayIndex++
                ).then(onSuccess);
            }
            const purchaseOptions = this.analysisRecoveryTradeInProgress && contract_type === 'DIGITEVEN'
                ? { ...this.tradeOptions, prediction: undefined, barrierOffset: undefined, secondBarrierOffset: undefined }
                : this.tradeOptions;
            const trade_option = tradeOptionToBuy(contract_type, purchaseOptions);
            const action = () => api_base.api.send(trade_option);

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return doUntilDone(action).then(onSuccess);
            }

            return recoverFromError(
                action,
                (errorCode, makeDelay) => {
                    if (errorCode === 'DisconnectError') {
                        this.clearProposals();
                    }
                    const unsubscribe = this.store.subscribe(() => {
                        const { scope } = this.store.getState();
                        if (scope === BEFORE_PURCHASE) {
                            makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                            unsubscribe();
                        }
                    });
                },
                ['PriceMoved', 'InvalidContractProposal'],
                delayIndex++
            ).then(onSuccess);
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
