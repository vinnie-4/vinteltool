/**
 * VintelTool paired RUNHIGH + RUNLOW strategy.
 *
 * This is intentionally separate from DBot Blockly. A single strategy
 * trigger requests both contracts and submits both buys as close together
 * as the browser WebSocket allows.
 */

export const PAIR_STRATEGY_DEFAULTS = {
    symbol: '1HZ100V',
    duration: 3,
    durationUnit: 't',
    initialStake: 1,
    martingaleMultiplier: 2,
} as const;

export type PairStakeState = {
    stake: number;
    lossesInRow: number;
};

export type PairTradeResult = {
    contractId: number;
    contractType: 'RUNHIGH' | 'RUNLOW';
    buyPrice: number;
    payout?: number;
    profit?: number;
    status?: string;
};

type ProposalResponse = {
    proposal?: {
        id: string;
        ask_price: number;
        payout?: number;
    };
    error?: { code?: string; message?: string };
};

type BuyResponse = {
    buy?: {
        contract_id: number;
        buy_price: number;
        payout?: number;
    };
    error?: { code?: string; message?: string };
};

type PairWebSocket = WebSocket;

const WS_BASE = 'wss://ws.derivws.com/websockets/v3';

const apiError = (payload: { error?: { code?: string; message?: string } }) =>
    payload.error ? new Error(`${payload.error.code ?? 'API_ERROR'}: ${payload.error.message ?? 'Deriv API error'}`) : null;

const sendAndWait = <T>(
    ws: PairWebSocket,
    request: Record<string, unknown>,
    expectedKey: string
): Promise<T> =>
    new Promise((resolve, reject) => {
        const onMessage = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data as string) as Record<string, unknown>;
                if (payload.msg_type !== expectedKey && !payload.error) return;
                ws.removeEventListener('message', onMessage);
                const error = apiError(payload);
                if (error) {
                    reject(error);
                    return;
                }
                resolve(payload as T);
            } catch (error) {
                ws.removeEventListener('message', onMessage);
                reject(error);
            }
        };

        ws.addEventListener('message', onMessage);
        ws.send(JSON.stringify(request));
    });

const connect = (appId: string): Promise<PairWebSocket> =>
    new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE}?app_id=${encodeURIComponent(appId)}`);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', () => reject(new Error('Unable to connect to Deriv WebSocket.')));
    });

const requestProposal = (
    ws: PairWebSocket,
    contractType: 'RUNHIGH' | 'RUNLOW',
    stake: number
) =>
    sendAndWait<ProposalResponse>(
        ws,
        {
            proposal: 1,
            amount: stake,
            basis: 'stake',
            contract_type: contractType,
            currency: 'USD',
            duration: PAIR_STRATEGY_DEFAULTS.duration,
            duration_unit: PAIR_STRATEGY_DEFAULTS.durationUnit,
            symbol: PAIR_STRATEGY_DEFAULTS.symbol,
        },
        'proposal'
    );

const buyProposal = (ws: PairWebSocket, proposal: ProposalResponse['proposal']) =>
    sendAndWait<BuyResponse>(
        ws,
        {
            buy: proposal?.id,
            price: proposal?.ask_price,
        },
        'buy'
    );

/**
 * Opens one RUNHIGH and one RUNLOW contract for the same trigger.
 *
 * The two proposal requests are started together. Once both proposal prices
 * are available, the two buy requests are dispatched together with Promise.all.
 * This is the closest pair-entry the public WebSocket API permits; it is not
 * an exchange-level atomic two-contract order.
 */
export async function executeOnlyUpsOnlyDownsPair(
    accessToken: string,
    appId: string,
    stake = PAIR_STRATEGY_DEFAULTS.initialStake
): Promise<PairTradeResult[]> {
    if (!accessToken) throw new Error('A Deriv access token is required.');
    if (!appId) throw new Error('A Deriv app ID is required.');
    if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be greater than zero.');

    const ws = await connect(appId);

    try {
        await sendAndWait(ws, { authorize: accessToken }, 'authorize');

        const [upProposalResponse, downProposalResponse] = await Promise.all([
            requestProposal(ws, 'RUNHIGH', stake),
            requestProposal(ws, 'RUNLOW', stake),
        ]);

        if (!upProposalResponse.proposal || !downProposalResponse.proposal) {
            throw new Error('Deriv did not return both pair proposals.');
        }

        const [upBuy, downBuy] = await Promise.all([
            buyProposal(ws, upProposalResponse.proposal),
            buyProposal(ws, downProposalResponse.proposal),
        ]);

        if (!upBuy.buy || !downBuy.buy) {
            throw new Error('Deriv did not return both pair purchases.');
        }

        return [
            {
                contractId: upBuy.buy.contract_id,
                contractType: 'RUNHIGH',
                buyPrice: upBuy.buy.buy_price,
                payout: upBuy.buy.payout,
            },
            {
                contractId: downBuy.buy.contract_id,
                contractType: 'RUNLOW',
                buyPrice: downBuy.buy.buy_price,
                payout: downBuy.buy.payout,
            },
        ];
    } finally {
        ws.close();
    }
}

/**
 * Pair-level martingale:
 * - start at $1 per contract
 * - after a losing pair, multiply the next pair stake by 2
 * - after a profitable pair, reset to $1
 */
export function nextPairStake(
    state: PairStakeState,
    pairProfit: number
): PairStakeState {
    if (pairProfit > 0) {
        return { stake: PAIR_STRATEGY_DEFAULTS.initialStake, lossesInRow: 0 };
    }

    return {
        stake: state.stake * PAIR_STRATEGY_DEFAULTS.martingaleMultiplier,
        lossesInRow: state.lossesInRow + 1,
    };
}
