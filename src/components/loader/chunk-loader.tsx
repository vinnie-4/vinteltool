import { useEffect, useState } from 'react';

export default function ChunkLoader({ message: _message }: { message: string }) {
    const [activeDot, setActiveDot] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveDot(current => (current + 1) % 3);
        }, 450);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <div className='vinteltool-loader' role='status' aria-live='polite'>
            <div className='vinteltool-loader__glow' aria-hidden='true' />
            <div className='vinteltool-loader__content'>
                <div className='vinteltool-loader__mark' aria-hidden='true'>
                    <span className='vinteltool-loader__ring' />
                    <span className='vinteltool-loader__letters'>
                        <span>V</span><span>T</span>
                    </span>
                </div>
                <div className='vinteltool-loader__brand'>
                    Vintel<span>Tool</span>
                </div>
                <div className='vinteltool-loader__status'>
                    <span>Loading</span>
                    <span className='vinteltool-loader__dots' aria-hidden='true'>
                        {[0, 1, 2].map(index => (
                            <i key={index} className={index === activeDot ? 'is-active' : ''} />
                        ))}
                    </span>
                </div>
            </div>

            <style>{`
                .vinteltool-loader {
                    min-height: 100vh;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                    background: #061a3a;
                    color: #fff;
                    font-family: Arial, Helvetica, sans-serif;
                    isolation: isolate;
                }

                .vinteltool-loader__glow {
                    position: absolute;
                    width: 320px;
                    height: 320px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(22,135,255,.22) 0%, rgba(22,135,255,.08) 38%, transparent 70%);
                    filter: blur(8px);
                    animation: vinteltool-loader-glow 2.8s ease-in-out infinite;
                }

                .vinteltool-loader__content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                .vinteltool-loader__mark {
                    width: 86px;
                    height: 86px;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 22px;
                }

                .vinteltool-loader__ring {
                    position: absolute;
                    inset: 0;
                    border: 2px solid rgba(255,255,255,.18);
                    border-top-color: #1687ff;
                    border-right-color: #1687ff;
                    border-radius: 50%;
                    animation: vinteltool-loader-spin 1.25s linear infinite;
                }

                .vinteltool-loader__letters {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,.045);
                    border: 1px solid rgba(255,255,255,.16);
                    box-shadow: 0 0 28px rgba(22,135,255,.2);
                    font-size: 25px;
                    font-weight: 800;
                    letter-spacing: -2px;
                }

                .vinteltool-loader__letters span:first-child { color: #fff; }
                .vinteltool-loader__letters span:last-child { color: #e53935; }

                .vinteltool-loader__brand {
                    font-size: 28px;
                    line-height: 1;
                    font-weight: 700;
                    letter-spacing: -.7px;
                }

                .vinteltool-loader__brand span { color: #e53935; }

                .vinteltool-loader__status {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    margin-top: 15px;
                    min-height: 20px;
                    color: rgba(255,255,255,.68);
                    font-size: 13px;
                    letter-spacing: .35px;
                }

                .vinteltool-loader__dots {
                    display: inline-flex;
                    gap: 4px;
                    align-items: center;
                }

                .vinteltool-loader__dots i {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: rgba(255,255,255,.28);
                    transition: transform .2s ease, background .2s ease;
                }

                .vinteltool-loader__dots i.is-active {
                    background: #1687ff;
                    transform: scale(1.5);
                }

                @keyframes vinteltool-loader-spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes vinteltool-loader-glow {
                    0%, 100% { transform: scale(.86); opacity: .55; }
                    50% { transform: scale(1.08); opacity: 1; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .vinteltool-loader__ring,
                    .vinteltool-loader__glow { animation: none; }
                }
            `}</style>
        </div>
    );
}

// Visual splash only. AppContent removes it when real initialization is ready;
// there is no artificial timeout or fake progress bar.
