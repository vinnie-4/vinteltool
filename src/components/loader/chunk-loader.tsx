import { useEffect, useState } from 'react';

const LOADER_STEPS = [
    'Initializing VintelTool...',
    'Loading trading environment...',
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
                background: '#2f2f2f',
                color: '#fff',
                fontFamily: 'Times New Roman, Times, serif',
                boxSizing: 'border-box',
                padding: '24px',
            }}
        >
            <div
                style={{
                    width: 'min(420px, 100%)',
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        width: 88,
                        height: 88,
                        margin: '0 auto 18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.06)',
                        boxShadow: '0 0 28px rgba(255,255,255,0.10)',
                        animation: 'vinteltool-loader-pulse 1.8s ease-in-out infinite',
                        overflow: 'hidden',
                    }}
                >
                    <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>VintelTool</span>
                </div>

                <div style={{ fontSize: 25, fontWeight: 700, marginBottom: 6 }}>VintelTool</div>
                <div style={{ fontSize: 14, opacity: 0.68, marginBottom: 30 }}>
                    Your Ultimate Trusted Deriv Trading Tool
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 999,
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.12)',
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: '#fff',
                                transition: 'width 90ms linear',
                            }}
                        />
                    </div>
                    <span style={{ minWidth: 38, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                        {progress}%
                    </span>
                </div>

                <div style={{ marginTop: 14, minHeight: 20, fontSize: 13, opacity: 0.72 }}>
                    {progress === 100 ? 'Initializing... Opening dashboard...' : LOADER_STEPS[step]}
                </div>
            </div>

            <style>{`
                @keyframes vinteltool-loader-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.045); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
