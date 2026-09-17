import { useEffect, useState } from 'react';

export default function ChunkLoader({ message }: { message: string }) {
    const [activeDot, setActiveDot] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveDot(current => (current + 1) % 3);
        }, 450);

        return () => window.clearInterval(interval);
    }, []);

    const statusMessage = message?.trim() || 'Initializing D-Bot...';

    return (
        <div className='vinteltool-loader' role='status' aria-live='polite'>
            <div className='vinteltool-loader__tint' aria-hidden='true' />
            <div className='vinteltool-loader__card'>
                <div className='vinteltool-loader__badge' aria-hidden='true'>VT</div>
                <div className='vinteltool-loader__title'>VINTELTOOL</div>
                <div className='vinteltool-loader__subtitle'>VintelTool Trading Workspace</div>

                <div className='vinteltool-loader__dots' aria-hidden='true'>
                    {[0, 1, 2].map(index => (
                        <span key={index} className={index === activeDot ? 'is-active' : ''} />
                    ))}
                </div>

                <div className='vinteltool-loader__status'>{statusMessage}</div>
                <div className='vinteltool-loader__progress' aria-hidden='true'>
                    <span />
                </div>
                <div className='vinteltool-loader__footer'>
                    <span>Boot sequence</span>
                    <span className='vinteltool-loader__ready'>LIVE</span>
                </div>
            </div>

            <style>{`
                .vinteltool-loader {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    box-sizing: border-box;
                    background: url('vinteltool-bg.jpg') center center / cover no-repeat;
                    color: #fff;
                    font-family: Arial, Helvetica, sans-serif;
                    isolation: isolate;
                    z-index: 9999;
                }

                .vinteltool-loader__tint {
                    position: absolute;
                    inset: 0;
                    background: rgba(5, 10, 20, .78);
                }

                .vinteltool-loader__card {
                    position: relative;
                    z-index: 1;
                    width: min(90%, 420px);
                    box-sizing: border-box;
                    padding: 32px 24px 20px;
                    border-radius: 16px;
                    background: rgba(18, 26, 43, .65);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, .08);
                    box-shadow: 0 20px 50px rgba(0, 0, 0, .6);
                    text-align: center;
                }

                .vinteltool-loader__badge {
                    width: 52px;
                    height: 52px;
                    margin: 0 auto 16px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, .05);
                    border: 1px solid rgba(255, 255, 255, .12);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    font-size: 16px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #94a3b8;
                }

                .vinteltool-loader__title {
                    font-size: 20px;
                    line-height: 1.2;
                    font-weight: 800;
                    letter-spacing: 1.5px;
                }

                .vinteltool-loader__subtitle {
                    margin-top: 7px;
                    color: #94a3b8;
                    font-size: 12px;
                    line-height: 1.4;
                }

                .vinteltool-loader__dots {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    margin-top: 25px;
                    min-height: 8px;
                }

                .vinteltool-loader__dots span {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(96, 165, 250, .28);
                    transition: transform .2s ease, opacity .2s ease, background .2s ease;
                    animation: vinteltool-loader-pulse 1.2s ease-in-out infinite;
                }

                .vinteltool-loader__dots span:nth-child(2) { animation-delay: .15s; }
                .vinteltool-loader__dots span:nth-child(3) { animation-delay: .3s; }

                .vinteltool-loader__dots span.is-active {
                    background: #60a5fa;
                    transform: scale(1.15);
                }

                .vinteltool-loader__status {
                    margin-top: 15px;
                    min-height: 18px;
                    color: #e2e8f0;
                    font-size: 12px;
                    line-height: 18px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .vinteltool-loader__progress {
                    height: 3px;
                    width: 100%;
                    margin-top: 16px;
                    overflow: hidden;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, .08);
                }

                .vinteltool-loader__progress span {
                    display: block;
                    width: 42%;
                    height: 100%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #2563eb, #60a5fa);
                    animation: vinteltool-loader-progress 1.45s ease-in-out infinite;
                }

                .vinteltool-loader__footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 10px;
                    color: #64748b;
                    font-size: 10px;
                    letter-spacing: .4px;
                    text-transform: uppercase;
                }

                .vinteltool-loader__ready {
                    color: #60a5fa;
                }

                @keyframes vinteltool-loader-pulse {
                    0%, 100% { opacity: .35; transform: scale(.85); }
                    50% { opacity: .95; transform: scale(1); }
                }

                @keyframes vinteltool-loader-progress {
                    0% { transform: translateX(-125%); }
                    100% { transform: translateX(255%); }
                }

                @media (max-width: 480px) {
                    .vinteltool-loader__card {
                        width: calc(100% - 32px);
                        padding: 28px 20px 18px;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .vinteltool-loader__dots span,
                    .vinteltool-loader__progress span { animation: none; }
                    .vinteltool-loader__progress span { width: 100%; }
                }
            `}</style>
        </div>
    );
}

// Visual splash only. AppContent removes it when real initialization is ready;
// there is no artificial timeout, fake percentage, or simulated boot completion.
