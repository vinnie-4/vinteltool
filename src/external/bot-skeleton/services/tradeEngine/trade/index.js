import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { expectInitArg } from '../utils/sanitize';
import { isFastExecution } from '../execution/execution-mode';
import { proposalsReady, start } from './state/actions';
import * as constants from './state/constants';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';

const watchBefore = (store, scope, symbol) =>
    watchScope({
        store,
        scope,
        symbol,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
        fast: isFastExecution(),
    });

const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
        fast: false,
    });

let prevTick;
const watchScope = ({ store, scope, symbol, stopScope, passScope, passFlag, fast }) => {
    if (store.getState().scope === stopScope) return Promise.resolve(false);

    return new Promise(resolve => {
        let settled = false;
        let removeFastListener = () => {};
        let unsubscribe;

        const cleanup = () => {
            removeFastListener();
            unsubscribe?.();
        };

        const finish = value => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        };

        // FAST uses the live tick callback directly. NORMAL keeps the original
        // Redux subscription path. This makes FAST meaningfully different while
        // preserving the exact same strategy and market-tick source.
        if (fast && scope?.tradeEngine?.addFastTickListener) {
            removeFastListener = scope.tradeEngine.addFastTickListener(epoch => {
                if (epoch === prevTick) return;
                prevTick = epoch;

                const state = store.getState();
                if (state.scope === passScope && state[passFlag]) {
                    finish(true);
                }
            });
        } else if (fast && scope?.addFastTickListener) {
            removeFastListener = scope.addFastTickListener(epoch => {
                if (epoch === prevTick) return;
                prevTick = epoch;

                const state = store.getState();
                if (state.scope === passScope && state[passFlag]) {
                    finish(true);
                }
            });
        }

        unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            if (!fast && newState.newTick !== prevTick) {
                prevTick = newState.newTick;
                if (newState.scope === passScope && newState[passFlag]) {
                    finish(true);
                    return;
                }
            }

            if (newState.scope === stopScope) finish(false);
        });

        // The live tick subscription is owned by TradeEngine/Ticks. FAST must
        // never create a second API polling loop or fabricate a market tick.
        void scope;
        void symbol;
    });
};

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.fastTickListeners = new Set();
        this.observe();
        this.data = { contract: {}, proposals: [] };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
    }

    init(...args) {
        const [token, options] = expectInitArg(args);
        const { symbol } = options;
        this.initArgs = args;
        this.options = options;
        this.startPromise = this.loginAndGetBalance(token);
        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', getLocalizedErrorMessage('NotInitialized'));
        }
        globalObserver.emit('bot.running');
        const validated_trade_options = this.validateTradeOptions(tradeOptions);
        this.tradeOptions = { ...validated_trade_options, symbol: this.options.symbol };
        this.analysisRecoveryBaseStake = Number(validated_trade_options.amount) || 0;
        this.analysisRecoveryLastContractId = null;
        this.analysisRecoveryPending = false;
        this.analysisRecoveryTradeInProgress = false;
        this.scannerRiskLimits = null;
        this.scannerSessionProfit = 0;
        this.scannerRiskStopTriggered = false;
        try {
            const scannerLimits = JSON.parse(window.localStorage.getItem('vinteltool-scanner-risk-limits') || 'null');
            if (scannerLimits?.enabled) {
                this.scannerRiskLimits = {
                    takeProfit: Math.max(0, Number(scannerLimits.takeProfit) || 0),
                    stopLoss: Math.max(0, Number(scannerLimits.stopLoss) || 0),
                    stopAfterRecoveryWin: Boolean(scannerLimits.stopAfterRecoveryWin),
                };
                window.localStorage.removeItem('vinteltool-scanner-risk-limits');
            }
        } catch { /* optional scanner limits must not prevent normal bot startup */ }
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);
        this.makeDirectPurchaseDecision();
    }

    loginAndGetBalance(token) {
        if (this.token === token) return Promise.resolve();
        this.accountInfo = api_base.account_info;
        this.token = api_base.token;
        return new Promise(resolve => {
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'transaction' && data.transaction.action === 'sell') {
                    this.transaction_recovery_timeout = setTimeout(() => {
                        const { contract } = this.data;
                        const is_same_contract = contract.contract_id === data.transaction.contract_id;
                        const is_open_contract = contract.status === 'open';
                        if (is_same_contract && is_open_contract) {
                            doUntilDone(() => {
                                api_base.api.send({ proposal_open_contract: 1, contract_id: contract.contract_id });
                            }, ['PriceMoved']);
                        }
                    }, 1500);
                }
                resolve();
            });
            api_base.pushSubscription(subscription);
        });
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    watch(watchName) {
        if (watchName === 'before') return watchBefore(this.store, this, this.options?.symbol);
        return watchDuring(this.store);
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        this.is_proposal_subscription_required = has_payout_block || is_basis_payout;
        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
