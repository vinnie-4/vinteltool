import { useEffect, useState } from 'react';

const LOADER_STEPS = [
    'Initializing VintelTool...',
    'Loading Vintel trading environment...',
    'Connecting to Deriv...',
    'Preparing workspace...',
    'Loading dashboard...',
    'Initializing...',
];

export default function ChunkLoader({ message: _message }: { message: string }) {
    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setProgress(current => {
                if (current >= 100) return 100;
                const next = Math.min(100, current + (current < 70 ? 2 : 1));
                setStep(Math.min(LOADER_STEPS.length - 1, Math.floor(next / 20)));
                return next;
            });
        }, 90);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <div
            className='vinteltool-loader'
            role='status'
            aria-live='polite'
            style={{
                minHeight: '100vh',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: '#061a3a',
                color: '#fff',
                fontFamily: 'Times New Roman, Times, serif',
                boxSizing: 'border-box',
                padding: '24px',
            }}
        >
            <div className='vinteltool-loader-floaters' aria-hidden='true'>
                <span>vinteltool.site</span>
                <span>↗ vinteltool.site</span>
                <span>vinteltool.site</span>
                <span>↗</span>
                <span>vinteltool.site</span>
                <span>↘ vinteltool.site</span>
                <span>vinteltool.site</span>
                <span>↗ vinteltool.site</span>
            </div>

            <div style={{ width: 'min(420px, 100%)', textAlign: 'center', position: 'relative', zIndex: 2 }}>
                <div
                    style={{
                        width: 92,
                        height: 92,
                        margin: '0 auto 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '3px solid #1687ff',
                        background: 'transparent',
                        boxShadow: '0 0 30px rgba(22,135,255,0.35)',
                        animation: 'vinteltool-box-fade 2.2s ease-in-out infinite, vinteltool-box-rotate 4s linear infinite',
                    }}
                >
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px' }}>
                        <span style={{ color: '#fff' }}>V</span><span style={{ color: '#e53935' }}>T</span>
                    </span>
                </div>

                <div style={{ fontSize: 27, fontWeight: 700, marginBottom: 7 }}>
                    Vintel<span style={{ color: '#e53935' }}>Tool</span>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.35, opacity: 0.78, marginBottom: 28 }}>
                    Your Ultimate Trusted Deriv Advanced
                    <br />
                    Trading Tool
                </div>

                <div style={{ textAlign: 'left', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                        Loading Vintel trading environment...
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{LOADER_STEPS[step]}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <div
                        style={{
                            flex: 1,
                            height: 7,
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.24)',
                            background: 'rgba(0,0,0,0.18)',
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: '#1687ff',
                                transition: 'width 90ms linear',
                            }}
                        />
                    </div>
                    <span style={{ minWidth: 38, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                        {progress}%
                    </span>
                </div>

                <div style={{ marginTop: 13, fontSize: 12, opacity: 0.65, letterSpacing: 1.2 }}>
                    BOOT SEQUENCE
                </div>
            </div>

            <style>{`
                .vinteltool-loader-floaters {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                    opacity: 0.16;
                }

                .vinteltool-loader-floaters span {
                    position: absolute;
                    font-size: 14px;
                    font-weight: 700;
                    color: #fff;
                    white-space: nowrap;
                    animation: vinteltool-float 9s linear infinite;
                }

                .vinteltool-loader-floaters span:nth-child(1) { left: 6%; top: 72%; animation-delay: -2s; }
                .vinteltool-loader-floaters span:nth-child(2) { left: 15%; top: 20%; animation-delay: -6s; }
                .vinteltool-loader-floaters span:nth-child(3) { left: 73%; top: 25%; animation-delay: -4s; }
                .vinteltool-loader-floaters span:nth-child(4) { left: 88%; top: 70%; animation-delay: -8s; }
                .vinteltool-loader-floaters span:nth-child(5) { left: 64%; top: 82%; animation-delay: -1s; }
                .vinteltool-loader-floaters span:nth-child(6) { left: 27%; top: 84%; animation-delay: -5s; }
                .vinteltool-loader-floaters span:nth-child(7) { left: 86%; top: 42%; animation-delay: -7s; }
                .vinteltool-loader-floaters span:nth-child(8) { left: 3%; top: 38%; animation-delay: -3s; }

                @keyframes vinteltool-float {
                    0% { transform: translate3d(0, 35px, 0); opacity: 0; }
                    15% { opacity: 0.8; }
                    50% { transform: translate3d(22px, -35px, 0); opacity: 0.55; }
                    85% { opacity: 0.8; }
                    100% { transform: translate3d(-18px, -110px, 0); opacity: 0; }
                }

                @keyframes vinteltool-box-fade {
                    0%, 100% { opacity: 0.45; box-shadow: 0 0 16px rgba(22,135,255,0.18); }
                    50% { opacity: 1; box-shadow: 0 0 34px rgba(22,135,255,0.5); }
                }

                @keyframes vinteltool-box-rotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .vinteltool-loader-floaters span,
                    .vinteltool-loader > div > div:first-child {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
