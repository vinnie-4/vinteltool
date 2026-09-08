import React from 'react';
import './styles.scss';

const lessons = [
    ['🎯', 'Introduction to Deriv Options', 'Understand what Options trading is, how contracts work, and the basic terminology used on Deriv.'],
    ['📚', 'Understanding Options', 'Learn how a prediction becomes a contract, including entry, exit, duration, payout, and potential profit or loss.'],
    ['📈', 'Rise / Fall', 'Learn how Rise and Fall contracts work and how your prediction determines the contract outcome.'],
    ['🔢', 'Higher / Lower', 'Understand digit contracts based on whether the last digit is higher or lower than a selected value.'],
    ['⚖️', 'Even / Odd', 'Learn how Even and Odd digit contracts work and how the final digit determines the result.'],
    ['🔀', 'Over / Under', 'Understand Over and Under digit predictions, including selecting a barrier and reading the expected outcome.'],
    ['🎯', 'Touch / No Touch', 'Learn how Touch and No Touch contracts work and how the selected barrier affects the prediction.'],
    ['↔️', 'Matches / Differs', 'Understand Matches and Differs contracts and how the final digit is compared with your selected prediction.'],
    ['⏱️', 'Duration & Ticks', 'Learn seconds, minutes and tick durations, and why duration is important when entering an Options contract.'],
    ['💰', 'Stake, Payout & Profit', 'Understand stake, payout, potential profit, contract cost and how to read the figures before buying.'],
    ['🧮', 'Understanding Contract Results', 'Learn how contract results are determined and how win, loss and expiry relate to your prediction.'],
    ['📊', 'Reading the Market', 'Learn basic chart reading, price movement, volatility and why past movement does not guarantee the next result.'],
    ['🛡️', 'Risk Management', 'Use sensible stake sizing, stop-loss limits and session rules to manage trading risk.'],
    ['🧠', 'Trading Psychology', 'Build discipline, avoid revenge trading and understand why emotions can affect Options decisions.'],
    ['🤖', 'Options & Bot Trading', 'Understand how Options contracts can be automated with bots while keeping contract selection and risk controls deliberate.'],
    ['📝', 'Practical Trading Checklist', 'Review the essential checks to make before purchasing any Deriv Options contract.'],
    ['🎓', 'Final Course Review', 'Bring the lessons together and build a clear, disciplined approach to learning Options trading.'],
];

const DerivCourse = () => (
    <section className='deriv-course'>
        <header className='deriv-course__intro'>
            <div className='deriv-course__badge'>🎓</div>
            <h1>Deriv Options Course</h1>
            <p>📖 A structured beginner-to-practical course focused only on Deriv Options trading.</p>
            <p className='deriv-course__notice'>⚠️ Educational content only. Options trading involves financial risk.</p>
        </header>

        <div className='deriv-course__lessons'>
            {lessons.map(([emoji, title, description], index) => (
                <article className='deriv-course__lesson' key={title}>
                    <div className='deriv-course__number'>{index + 1}</div>
                    <div className='deriv-course__emoji'>{emoji}</div>
                    <div>
                        <h2>{title}</h2>
                        <p>{description}</p>
                    </div>
                </article>
            ))}
        </div>
    </section>
);

export default DerivCourse;
