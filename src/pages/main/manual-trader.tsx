import React, { useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { doUntilDone } from '@/external/bot-skeleton/services/tradeEngine/utils/helpers';
import AnalysisTool from '../analysis-tool';
import './main.scss';

const VOLATILITY_SYMBOLS: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 10 (1s)': '1HZ10V',
    'Volatility 15 (1s)': '1HZ15V',
    'Volatility 25': 'R_25',
    'Volatility 25 (1s)': '1HZ25V',
    'Volatility 30 (1s)': '1HZ30V',
    'Volatility 50': 'R_50',
    'Volatility 50 (1s)': '1HZ50V',
    'Volatility 75': 'R_75',
    'Volatility 75 (1s)': '1HZ75V',
    'Volatility 90 (1s)': '1HZ90V',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
};

const CONTRACT_TYPES: Record<string, string> = {
    Even: 'DIGITEVEN',
    Odd: 'DIGITODD',
    Over: 'DIGITOVER',
    Under: 'DIGITUNDER',
};

const waitForTradingApi = async () => {
    const started = Date.now();
    const timeout = 10000;

    while (Date.now() - started < timeout) {
        const api = api_base.api;
        if (api?.connection?.readyState === WebSocket.OPEN && api_base.is_authorized) return api;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    throw new Error('Deriv trading connection is not ready. Please log in and try again.');
};

const ManualTraderStructure = () => {
    const [tradeType, setTradeType] = useState('Even/Odd');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [analysisTicks, setAnalysisTicks] = useState(1000);
    const [duration, setDuration] = useState(1);
    const [stake, setStake] = useState(0.5);
    const [bulkTrades, setBulkTrades] = useState(1);
    const [prediction, setPrediction] = useState(1);
    const [isTrading, setIsTrading] = useState(false);
    const tradeLockRef = useRef(false);
    const selectedVolatility = Object.keys(VOLATILITY_SYMBOLS).find(name => VOLATILITY_SYMBOLS[name] === symbol) || 'Volatility 100 (1s)';

    const executeOneTrade = async (contractType: string) => {
        const api = await waitForTradingApi();
        const currency = api_base.account_info?.currency || 'USD';

        const proposalRequest: Record<string, unknown> = {
            proposal: 1,
            amount: Number(stake),
            basis: 'stake',
            contract_type: contractType,
            currency,
            duration: Number(duration),
            duration_unit: 't',
            underlying_symbol: symbol,
        };

        if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') proposalRequest.barrier = Number(prediction);

        const proposalResponse = await doUntilDone(() => api.send(proposalRequest), [], api_base);
        if (proposalResponse?.error) throw new Error(proposalResponse.error.message || 'Unable to create trade proposal.');

        const proposal = proposalResponse?.proposal;
        if (!proposal?.id || proposal.ask_price === undefined) throw new Error('Deriv returned an invalid trade proposal.');

        const buyResponse = await doUntilDone(() => api.send({ buy: proposal.id, price: proposal.ask_price }), [], api_base);
        if (buyResponse?.error) throw new Error(buyResponse.error.message || 'Unable to purchase the contract.');
        if (!buyResponse?.buy?.contract_id && !buyResponse?.buy?.transaction_id) throw new Error('Deriv did not confirm the purchased contract.');
        return buyResponse.buy;
    };

    const handleTrade = async (selection: 'Even' | 'Odd' | 'Over' | 'Under') => {
        if (tradeLockRef.current) return;
        const count = Math.max(1, Math.floor(Number(bulkTrades) || 1));
        const amount = Number(stake);
        const ticks = Math.max(1, Math.floor(Number(duration) || 1));

        if (!Number.isFinite(amount) || amount <= 0) { window.alert('Enter a valid stake greater than 0.'); return; }
        if (!Number.isFinite(ticks) || ticks < 1) { window.alert('Ticks must be at least 1.'); return; }
        if ((selection === 'Over' || selection === 'Under') && (!Number.isInteger(Number(prediction)) || Number(prediction) < 0 || Number(prediction) > 9)) { window.alert('Prediction must be a digit from 0 to 9.'); return; }

        tradeLockRef.current = true;
        setIsTrading(true);
        try {
            const results = await Promise.all(Array.from({ length: count }, () => executeOneTrade(CONTRACT_TYPES[selection])));
            console.info(`[Manual Trader] ${results.length} ${selection} transaction(s) purchased.`);
        } catch (error) {
            console.error('[Manual Trader] transaction error:', error);
            window.alert(error instanceof Error ? error.message : 'Trade failed.');
        } finally {
            tradeLockRef.current = false;
            setIsTrading(false);
        }
    };

    return <div className='manual-trader'>
        <div className='manual-trader__top-row'>
            <div className='manual-trader__volatility'>
                <span>Volatility</span>
                <select value={selectedVolatility} onChange={event => setSymbol(VOLATILITY_SYMBOLS[event.target.value])}>
                    {Object.keys(VOLATILITY_SYMBOLS).map(name => <option key={name}>{name}</option>)}
                </select>
            </div>
            <div className='manual-trader__analysis-ticks'>
                <span>Ticks</span>
                <select value={analysisTicks} onChange={event => setAnalysisTicks(Number(event.target.value))}>
                    <option value='1000'>1000</option><option value='500'>500</option><option value='300'>300</option><option value='100'>100</option><option value='60'>60</option><option value='30'>30</option>
                </select>
            </div>
            <div className='manual-trader__trade-type'>
                <span>TRADE TYPE</span>
                <select value={tradeType} onChange={event => setTradeType(event.target.value)}>
                    <option>Even/Odd</option><option>Over/Under</option>
                </select>
            </div>
        </div>
        <AnalysisTool
            showLegend={false}
            showSubtabs={false}
            showControls={false}
            selectedIndex={selectedVolatility}
            windowSize={analysisTicks}
        />
        <div className='manual-trader__trade-inputs'>
            <label>Ticks<input type='number' min='1' step='1' value={duration} onChange={event => setDuration(Number(event.target.value))} /></label>
            <label>Stake<input type='number' min='0' step='0.01' value={stake} onChange={event => setStake(Number(event.target.value))} /></label>
            <label>No. of Bulk Trades<input type='number' min='1' step='1' value={bulkTrades} onChange={event => setBulkTrades(Number(event.target.value))} /></label>
            {tradeType === 'Over/Under' && <label>Prediction<input type='number' min='0' max='9' step='1' value={prediction} onChange={event => setPrediction(Number(event.target.value))} /></label>}
        </div>
        <div className='manual-trader__trade-buttons'>
            {tradeType === 'Even/Odd' ? <>
                <button type='button' className='manual-trader__even' disabled={isTrading} onClick={() => handleTrade('Even')}>Even</button>
                <button type='button' className='manual-trader__odd' disabled={isTrading} onClick={() => handleTrade('Odd')}>Odd</button>
            </> : <>
                <button type='button' className='manual-trader__over' disabled={isTrading} onClick={() => handleTrade('Over')}>Over</button>
                <button type='button' className='manual-trader__under' disabled={isTrading} onClick={() => handleTrade('Under')}>Under</button>
            </>}
        </div>
    </div>;
};

export default ManualTraderStructure;
