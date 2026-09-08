import React, { useState } from 'react';

const lessons = [
    {
        title: '🎓 Options-focused course only',
        description: 'This course is about Deriv Options trading. You will learn the basic contract types, how they work, and the important choices you make before placing an Options trade. It is written for beginners, so start from the top and move through each lesson in order.',
    },
    {
        title: '📚 Structured lessons',
        description: 'Each lesson explains one part of Options trading in simple language. Tap a heading to open its explanation. When you finish one topic, close it and continue to the next one. You can scroll down to see all the lessons.',
    },
    {
        title: '📈 Rise/Fall',
        description: 'Rise/Fall is a simple prediction about where the market will be at the end of your contract. Choose Rise when you predict the final price will be higher than the starting price. Choose Fall when you predict it will be lower. Your prediction must be correct at the contract end for the trade to win.',
    },
    {
        title: '🔢 Higher/Lower, Even/Odd',
        description: 'Higher/Lower lets you predict whether the last digit of the contract result will be higher or lower than a chosen number. Even/Odd lets you predict whether the last digit will be an even number such as 0, 2, 4, 6 or 8, or an odd number such as 1, 3, 5, 7 or 9. These trades focus on the final digit rather than the overall direction of the market.',
    },
    {
        title: '🔀 Over/Under',
        description: 'Over/Under is a last-digit prediction. You choose a number and predict that the final digit will be over it or under it. For example, with Over 5, you are predicting a final digit of 6, 7, 8 or 9. With Under 5, you are predicting 0, 1, 2, 3 or 4.',
    },
    {
        title: '🎯 Touch/No Touch',
        description: 'Touch/No Touch is about whether the market reaches a selected price level during the contract. Touch means you predict that the market will reach the target level at least once. No Touch means you predict that the market will not reach that level before the contract ends.',
    },
    {
        title: '↔️ Matches/Differs',
        description: 'Matches/Differs is a prediction about the final digit. Matches means you predict that the final digit will be the exact number you selected. Differs means you predict that the final digit will be any number except the one you selected.',
    },
    {
        title: '⏱️ Duration/ticks',
        description: 'Duration is how long your contract lasts. In tick-based contracts, one tick represents one price update. A short duration gives the market less time to move, while a longer duration gives it more time. Always understand the contract duration before buying it.',
    },
    {
        title: '💰 Stake/payout',
        description: 'Stake is the amount of money you put into one contract. Payout is the amount returned when the contract finishes with a winning result. Your profit is generally the payout minus your stake. A possible payout is not the same as a guaranteed profit, because a losing contract can result in the loss of the stake.',
    },
    {
        title: '🛡️ Risk management',
        description: 'Risk management means controlling how much money you are willing to lose. Use a stake size that your trading balance can handle, set sensible limits for your daily losses, and avoid increasing stakes just because a previous trade lost. Never risk money you cannot afford to lose.',
    },
    {
        title: '🧠 Psychology',
        description: 'Good trading requires discipline. A loss does not mean you must immediately place another trade to recover it, and a win does not mean every next trade will win. Avoid revenge trading, fear-based decisions and overconfidence. Follow your plan and take breaks when you are no longer thinking clearly.',
    },
    {
        title: '🤖 Options + bots',
        description: 'A trading bot can automate steps such as selecting a contract, setting a stake and placing trades according to programmed rules. A bot does not guarantee profit. Before running a bot with real money, understand its rules, test it on a demo account, check its stake and risk limits, and make sure you know how to stop it.',
    },
    {
        title: '📝 Practical checklist',
        description: 'Before trading, check: the market and contract type, your prediction, the duration, the stake, the possible payout, and your maximum acceptable loss. Confirm that you understand the trade before buying it. If you are using a bot, check its strategy and stop conditions. Start with a demo account while learning and only use real funds when you fully understand the risks.',
    },
];

const DerivCourse = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleLesson = (index: number) => {
        setOpenIndex(current => (current === index ? null : index));
    };

    return (
        <section
            aria-label='Deriv Options Course'
            style={{
                width: '100%',
                maxWidth: 760,
                margin: '0 auto',
                padding: '16px 12px 120px',
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    maxHeight: 'calc(100vh - 190px)',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    padding: '2px 4px 24px',
                }}
            >
                {lessons.map((lesson, index) => {
                    const isOpen = openIndex === index;
                    return (
                        <div key={lesson.title} style={{ marginBottom: 8 }}>
                            <button
                                type='button'
                                onClick={() => toggleLesson(index)}
                                aria-expanded={isOpen}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '14px 15px',
                                    border: '1px solid var(--border-normal, #d6d6d6)',
                                    borderRadius: 8,
                                    background: 'var(--general-main-1, #fff)',
                                    color: 'var(--text-general, #222)',
                                    textAlign: 'left',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <span>{lesson.title}</span>
                                <span aria-hidden='true' style={{ flexShrink: 0, fontSize: 18 }}>
                                    {isOpen ? '−' : '+'}
                                </span>
                            </button>
                            {isOpen && (
                                <div
                                    style={{
                                        padding: '12px 15px 14px',
                                        color: 'var(--text-general, #333)',
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        background: 'var(--general-section-1, #f7f7f7)',
                                        borderLeft: '1px solid var(--border-normal, #d6d6d6)',
                                        borderRight: '1px solid var(--border-normal, #d6d6d6)',
                                        borderBottom: '1px solid var(--border-normal, #d6d6d6)',
                                        borderRadius: '0 0 8px 8px',
                                    }}
                                >
                                    {lesson.description}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default DerivCourse;
