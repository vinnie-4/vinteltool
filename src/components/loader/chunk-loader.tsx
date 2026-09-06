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
                <span>VT</span>
                <span>01</span>
                <span>FX</span>
                <span>↗</span>
                <span>VT</span>
                <span>∞</span>
                <span>01</span>
                <span>FX</span>
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
                        border: '2px solid rgba(255,255,255,0.72)',
                        background: 'rgba(255,255,255,0.035)',
                        boxShadow: '0 0 30px rgba(255,255,255,0.12)',
                        animation: 'vinteltool-box-fade 2.2s ease-in-out infinite',
                    }}
                >
                    <span
                        style={{
                            fontSize: 30,
                            fontWeight: 700,
                            letterSpacing: '-1px',
                            animation: 'vinteltool-box-rotate 4s linear infinite',
                        }}
                    >
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
                                background: '#fff',
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
                    font-size: 18px;
                    font-weight: 700;
                    color: #fff;
                    animation: vinteltool-float 9s linear infinite;
                }

                .vinteltool-loader-floaters span:nth-child(1) { left: 8%; top: 72%; animation-delay: -2s; }
                .vinteltool-loader-floaters span:nth-child(2) { left: 18%; top: 20%; animation-delay: -6s; }
                .vinteltool-loader-floaters span:nth-child(3) { left: 76%; top: 25%; animation-delay: -4s; }
                .vinteltool-loader-floaters span:nth-child(4) { left: 87%; top: 70%; animation-delay: -8s; }
                .vinteltool-loader-floaters span:nth-child(5) { left: 68%; top: 82%; animation-delay: -1s; }
                .vinteltool-loader-floaters span:nth-child(6) { left: 30%; top: 84%; animation-delay: -5s; }
                .vinteltool-loader-floaters span:nth-child(7) { left: 91%; top: 42%; animation-delay: -7s; }
                .vinteltool-loader-floaters span:nth-child(8) { left: 5%; top: 38%; animation-delay: -3s; }

                @keyframes vinteltool-float {
                    0% { transform: translate3d(0, 35px, 0) rotate(0deg); opacity: 0; }
                    15% { opacity: 0.8; }
                    50% { transform: translate3d(22px, -35px, 0) rotate(8deg); opacity: 0.55; }
                    85% { opacity: 0.8; }
                    100% { transform: translate3d(-18px, -110px, 0) rotate(-8deg); opacity: 0; }
                }

                @keyframes vinteltool-box-fade {
                    0%, 100% { opacity: 0.45; box-shadow: 0 0 16px rgba(255,255,255,0.06); }
                    50% { opacity: 1; box-shadow: 0 0 34px rgba(255,255,255,0.18); }
                }

                @keyframes vinteltool-box-rotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .vinteltool-loader-floaters span,
                    .vinteltool-loader-floaters,
                    .vinteltool-loader-floaters span,
                    .vinteltool-loader > div > div:first-child,
                    .vinteltool-loader > div > div:first-child span {
                        animation: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
