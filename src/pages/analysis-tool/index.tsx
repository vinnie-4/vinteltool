import React, { useMemo, useState } from 'react';
import './styles.scss';

const DIGITS = Array.from({ length: 10 }, (_, i) => i);
const VOLATILITY_INDICES = ['Volatility 10', 'Volatility 10 (1s)', 'Volatility 15 (1s)', 'Volatility 25', 'Volatility 25 (1s)', 'Volatility 30 (1s)', 'Volatility 50', 'Volatility 50 (1s)', 'Volatility 75', 'Volatility 75 (1s)', 'Volatility 90 (1s)', 'Volatility 100', 'Volatility 100 (1s)'];

const demoDigits = [7, 3, 8, 7, 2, 7, 1, 4, 7, 9, 3, 7, 5, 2, 8, 7, 0, 4, 6, 7, 3, 1, 7, 5, 9, 2, 7, 8, 4, 7];

const AnalysisTool = () => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(VOLATILITY_INDICES[0]);

    const stats = useMemo(() => {
        const counts = DIGITS.map(digit => ({ digit, count: demoDigits.filter(value => value === digit).length }));
        const total = counts.reduce((sum, item) => sum + item.count, 0);
        const max = Math.max(...counts.map(item => item.count));
        const min = Math.min(...counts.map(item => item.count));
        return counts.map(item => ({
            ...item,
            percentage: total ? (item.count / total) * 100 : 0,
            rankPercentage: max ? (item.count / max) * 100 : 0,
            isMost: item.count === max,
            isLeast: item.count === min,
        }));
    }, []);

    const latestDigit = demoDigits[demoDigits.length - 1];

    return (
        <section className='lda'>
            <header className='lda__header'>
                <div>
                    <h2>🎯 Last Digit Analysis (LDA)</h2>
                    <p>Live-style analysis of the last digit appearing on each tick.</p>
                </div>
                <select value={selectedIndex} onChange={event => setSelectedIndex(event.target.value)}>
                    {VOLATILITY_INDICES.map(index => <option key={index}>{index}</option>)}
                </select>
            </header>

            <div className='lda__latest'>
                <span>Latest last digit</span>
                <strong>{latestDigit}</strong>
                <small>Each new tick moves the pointer to the digit that just appeared.</small>
            </div>

            <div className='lda__circles' aria-label={`${selectedIndex} last digit analysis`}>
                {stats.map(item => (
                    <div className={`lda__digit ${item.isMost ? 'lda__digit--most' : ''} ${item.isLeast ? 'lda__digit--least' : ''}`} key={item.digit}>
                        <div className='lda__circle'>
                            <span>{item.digit}</span>
                            {item.digit === latestDigit && <i className='lda__pointer' aria-label='Latest digit pointer'>➤</i>}
                        </div>
                        <b>{item.percentage.toFixed(1)}%</b>
                        <div className='lda__bar'><span style={{ width: `${item.rankPercentage}%` }} /></div>
                        <small>{item.count} appearances</small>
                    </div>
                ))}
            </div>

            <div className='lda__legend'>
                <span>🟢 Green = most appearing digit</span>
                <span>🔴 Red = least appearing digit</span>
                <span>➤ = latest digit</span>
            </div>

            <div className='lda__sections'>
                {[
                    ['frequency', '📊 Digit frequency', 'See how often each digit from 0 to 9 has appeared in the selected sample.'],
                    ['distribution', '⚖️ Percentage distribution', 'Each digit receives its share of the ten possible last digits based on the observed tick sample.'],
                    ['sequence', '🔢 Recent sequence', 'The analyzer follows the latest digits in order so you can see the recent flow without treating it as a guaranteed prediction.'],
                    ['note', '⚠️ Important note', 'A frequent or rare digit does not guarantee what the next tick will be. This tool describes observed data only.'],
                ].map(([key, title, description]) => (
                    <button type='button' className='lda__section' key={key} onClick={() => setExpanded(expanded === key ? null : key)}>
                        <span>{title}</span><em>{expanded === key ? '−' : '+'}</em>
                        {expanded === key && <p>{description}</p>}
                    </button>
                ))}
            </div>
        </section>
    );
};

export default AnalysisTool;
