import { getRoundedNumber } from '@/components/shared';
import { api_base } from '../../api/api-base';
import { contract as broadcastContract, contractStatus } from '../utils/broadcast';
import { openContractReceived, sell } from './state/actions';

export default Engine =>
    class OpenContract extends Engine {
        observeOpenContract() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'proposal_open_contract') {
                    const contract = data.proposal_open_contract;

                    if (!contract || !this.expectedContractId(contract?.contract_id)) {
                        return;
                    }

                    this.setContractFlags(contract);

                    // One short beep on a finalized loss; a win beep only when analysis triggered the trade.
                    if (contract.is_expired || contract.is_sold) {
                        const contractKey = 'vinteltool-notified-contract-' + String(contract.contract_id);
                        try {
                            if (window.sessionStorage.getItem(contractKey) !== '1') {
                                const profit = Number(contract.profit);
                                const isFinalProfit = Number.isFinite(profit);
                                let shouldBeep = isFinalProfit && profit < 0;
                                let frequency = 420;
                                if (isFinalProfit && profit > 0 && window.localStorage.getItem('vinteltool-analysis-win-beep-eligible') === 'true') {
                                    shouldBeep = true;
                                    frequency = 740;
                                    window.localStorage.removeItem('vinteltool-analysis-win-beep-eligible');
                                }
                                if (shouldBeep) {
                                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                                    if (AudioContextClass) {
                                        const audio = new AudioContextClass();
                                        const oscillator = audio.createOscillator();
                                        const gain = audio.createGain();
                                        oscillator.type = 'sine';
                                        oscillator.frequency.value = frequency;
                                        gain.gain.setValueAtTime(0.0001, audio.currentTime);
                                        gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.01);
                                        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);
                                        oscillator.connect(gain);
                                        gain.connect(audio.destination);
                                        oscillator.start();
                                        oscillator.stop(audio.currentTime + 0.17);
                                        oscillator.onended = () => { void audio.close(); };
                                    }
                                }
                                window.sessionStorage.setItem(contractKey, '1');
                            }
                        } catch {}
                    }

                    // Optional, capped stake recovery for digit contracts only.
                    if (contract.is_expired || contract.is_sold) {
                        const settings = (() => {
                            try { return JSON.parse(window.localStorage.getItem('vinteltool-analysis-recovery-settings') || 'null'); }
                            catch { return null; }
                        })();
                        const isDigitContract = /^DIGIT/.test(String(contract.contract_type || '').toUpperCase());
                        if (settings?.enabled && settings?.recovery && isDigitContract && this.tradeOptions && Number.isFinite(Number(contract.profit)) && contract.contract_id !== this.analysisRecoveryLastContractId) {
                            this.analysisRecoveryLastContractId = contract.contract_id;
                            const baseStake = Number(this.analysisRecoveryBaseStake) || Number(this.tradeOptions.amount) || 0;
                            const multiplier = Math.max(1, Math.min(5, Number(settings.multiplier) || 2));
                            const maxStake = Math.max(baseStake, Number(settings.maxStake) || baseStake);
                            const currentStake = Math.max(baseStake, Number(this.tradeOptions.amount) || baseStake);
                            const profit = Number(contract.profit);
                            if (settings.recoveryOnlyAfterLoss) {
                                // Keep the recovery branch active after every losing Even
                                // contract. Clear it only when an Even recovery wins, so the
                                // next purchase resumes the scanner's primary contract.
                                const isEvenRecovery = this.analysisRecoveryTradeInProgress &&
                                    String(contract.contract_type || '').toUpperCase() === 'DIGITEVEN';
                                this.analysisRecoveryPending = profit < 0;
                                try {
                                    if (this.analysisRecoveryPending) {
                                        window.localStorage.setItem('vinteltool-recovery-analysis-state', JSON.stringify({
                                            pending: true,
                                            symbol: String(contract.underlying_symbol || contract.underlying || this.symbol || ''),
                                            contractId: String(contract.contract_id),
                                            mode: 'even-trade',
                                        }));
                                    } else {
                                        window.localStorage.removeItem('vinteltool-recovery-analysis-state');
                                    }
                                } catch {}
                            }
                            // Increase from the current stake after each consecutive loss,
                            // cap it at maxStake, and reset to the original stake after a win.
                            this.tradeOptions.amount = profit < 0
                                ? Math.min(currentStake * multiplier, maxStake)
                                : baseStake;
                        }
                    }

                    this.data.contract = contract;

                    broadcastContract({ accountID: api_base.account_info.loginid, ...contract });

                    if (this.isSold) {
                        this.contractId = '';
                        clearTimeout(this.transaction_recovery_timeout);
                        this.updateTotals(contract);

                        // Scanner-only session risk controls. Stop on cumulative take-profit,
                        // cumulative stop-loss, or the first winning recovery trade after analysis.
                        let scannerStopReason = '';
                        if (this.scannerRiskLimits && !this.scannerRiskStopTriggered) {
                            const settledProfit = Number.isFinite(Number(contract.profit))
                                ? Number(contract.profit)
                                : Number(contract.sell_price) - Number(contract.buy_price);
                            if (Number.isFinite(settledProfit)) {
                                this.scannerSessionProfit = Number((this.scannerSessionProfit + settledProfit).toFixed(8));
                                const limits = this.scannerRiskLimits;
                                if (limits.stopAfterRecoveryWin && this.analysisRecoveryTradeInProgress && settledProfit > 0) {
                                    scannerStopReason = 'Recovery analysis win';
                                } else if (limits.takeProfit > 0 && this.scannerSessionProfit >= limits.takeProfit) {
                                    scannerStopReason = 'Take profit reached';
                                } else if (limits.stopLoss > 0 && this.scannerSessionProfit <= -limits.stopLoss) {
                                    scannerStopReason = 'Stop loss reached';
                                }
                            }
                            this.analysisRecoveryTradeInProgress = false;
                            if (scannerStopReason) {
                                this.scannerRiskStopTriggered = true;
                                try {
                                    window.localStorage.setItem('vinteltool-scanner-risk-stop', JSON.stringify({
                                        reason: scannerStopReason,
                                        sessionProfit: this.scannerSessionProfit,
                                        contractId: String(contract.contract_id),
                                    }));
                                } catch {}
                                this.observer?.emit?.('bot.stop');
                            }
                        }

                        contractStatus({
                            id: 'contract.sold',
                            data: contract.transaction_ids.sell,
                            contract,
                        });

                        if (this.afterPromise) {
                            this.afterPromise();
                        }

                        this.store.dispatch(sell());
                    } else {
                        this.store.dispatch(openContractReceived());
                    }
                }
            });
            api_base.pushSubscription(subscription);
        }

        waitForAfter() {
            return new Promise(resolve => {
                this.afterPromise = resolve;
            });
        }

        setContractFlags(contract) {
            const { is_expired, is_valid_to_sell, is_sold, entry_tick } = contract;

            this.isSold = Boolean(is_sold);
            this.isSellAvailable = !this.isSold && Boolean(is_valid_to_sell);
            this.isExpired = Boolean(is_expired);
            this.hasEntryTick = Boolean(entry_tick);
        }

        expectedContractId(contractId) {
            return this.contractId && contractId === this.contractId;
        }

        getSellPrice() {
            const { bid_price: bidPrice, buy_price: buyPrice, currency } = this.data.contract;
            return getRoundedNumber(Number(bidPrice) - Number(buyPrice), currency);
        }
    };
