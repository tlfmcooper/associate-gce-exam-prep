import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { questions, Question } from './questions';
import './styles.css';

const App: React.FC = () => {
        const [showSidebar, setShowSidebar] = useState(true);
        const [isMobile, setIsMobile] = useState(false);
        const [showMobileNav, setShowMobileNav] = useState(false);
        const [mode, setMode] = useState<'landing' | 'practice' | 'exam'>('landing');
    const [examSessionIds, setExamSessionIds] = useState<number[] | null>(null);
    const [userAnswers, setUserAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
    const [flagged, setFlagged] = useState<boolean[]>(() => new Array(questions.length).fill(false));
    const [currentIndex, setCurrentIndex] = useState(0);

    const available = useMemo(() => {
        if (examSessionIds) return examSessionIds.map(id => questions.find(q => q.id === id)).filter(Boolean) as Question[];
        return questions;
    }, [examSessionIds]);

    const current = available[currentIndex];

    useEffect(() => {
        if (currentIndex >= available.length) setCurrentIndex(Math.max(0, available.length - 1));
    }, [available, currentIndex]);

    const shuffle = <T,>(arr: T[]) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    const startExam = () => {
        const ids = shuffle(questions.map(q => q.id)).slice(0, Math.min(50, questions.length));
        setExamSessionIds(ids);
        setUserAnswers(prev => {
            const copy = [...prev];
            ids.forEach(id => (copy[id] = null));
            return copy;
        });
        setFlagged(prev => {
            const copy = [...prev];
            ids.forEach(id => (copy[id] = false));
            return copy;
        });
        setCurrentIndex(0);
            setMode('exam');
            // hide sidebar on small screens for better mobile UX
            if (typeof window !== 'undefined') setShowSidebar(window.innerWidth > 900);
    };

    const clearExam = () => {
        setExamSessionIds(null);
        setCurrentIndex(0);
    };

        const startPractice = () => {
            // clear any exam session and switch to practice mode
            setExamSessionIds(null);
            setCurrentIndex(0);
            setMode('practice');
            // show sidebar only on larger screens
            if (typeof window !== 'undefined') setShowSidebar(window.innerWidth > 900);
        };

        // on mount, hide the sidebar automatically for narrow screens
        useEffect(() => {
            const update = () => {
                const mobile = window.innerWidth <= 900;
                setIsMobile(mobile);
                setShowSidebar(!mobile);
            };
            update();
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }, []);

    const selectOption = (idx: number) => {
        if (!current) return;
        const copy = [...userAnswers];
        copy[current.id] = idx;
        setUserAnswers(copy);
    };

    const toggleFlag = () => {
        if (!current) return;
        const copy = [...flagged];
        copy[current.id] = !copy[current.id];
        setFlagged(copy);
    };

    const exportCSV = () => {
        const header = ['id', 'question', 'selected', 'correct', 'flagged'];
        const rows = available.map(q => {
            const sel = userAnswers[q.id];
            const corr = q.correct;
            return [q.id, '"' + q.question.replace(/"/g, '""') + '"', sel === null ? '' : sel.toString(), corr.toString(), flagged[q.id] ? '1' : '0'].join(',');
        });
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'results.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

        // If we're on the landing page, render a full-bleed hero and big actions
            if (mode === 'landing') {
                return (
                    <div
                        className="landing-hero"
                        style={{
                            minHeight: '100vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(180deg, #0b4bd8 0%, #0b2e63 100%)',
                            color: '#fff',
                            padding: 0,
                            margin: 0,
                        }}
                    >
                        <div style={{ width: '100%', textAlign: 'center', padding: '80px 24px' }}>
                            {/* Cloud graphic */}
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }} aria-hidden>
                                <svg width="72" height="48" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <linearGradient id="g1" x1="0" x2="1">
                                            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                                            <stop offset="1" stopColor="#e6f0ff" stopOpacity="0.9" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M20 30c-6 0-10-5-10-10 0-5 4-10 10-10 2 0 4 0 6 1 3-5 9-6 15-3 5 3 7 9 5 14-1 4-5 8-11 8H20z" fill="url(#g1)" />
                                </svg>
                            </div>

                            <h1 style={{ fontSize: 56, margin: '0 0 8px', fontWeight: 800, lineHeight: 1.05 }}>Google Cloud<br />Associate Engineer</h1>
                            <p style={{ marginTop: 8, fontSize: 18, opacity: 0.95 }}>Practice Exam - 2025 Edition · 50 Questions</p>

                            <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center' }}>
                                <div style={{ width: 'min(820px, 92%)', textAlign: 'center', padding: '26px 30px', borderRadius: 14, background: 'rgba(0,0,0,0.12)' }}>
                                    <h2 style={{ color: '#fff', marginTop: 0, marginBottom: 6 }}>Start New Exam</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.9)', marginTop: 0 }}>Full-length practice exam simulating the real GCE certification test. All questions include explanations.</p>

                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
                                        <button onClick={() => { startExam(); setShowSidebar(true); }} style={{ background: '#1a73e8', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 8, fontSize: 16 }}>Start New Exam →</button>
                                        <button onClick={() => { startPractice(); }} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.16)', padding: '10px 18px', borderRadius: 8, fontSize: 16 }}>Practice</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

        return (
            <div className="app-layout">
                {/* top banner only when not on landing */}
                <div className="exam-banner fixed-banner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{mode === 'exam' ? `Exam — ${available.length} questions` : 'Practice'}</div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {/* navigator is hidden on mobile — no hamburger */}
                                            {mode !== 'exam' && (
                                                <button className="csv-btn" onClick={() => { startExam(); setShowSidebar(window.innerWidth > 900); }}>Start 50-Question Exam</button>
                                            )}
                                            <button className="csv-btn" onClick={() => { clearExam(); setMode('landing'); setShowSidebar(false); }}>Back to Home</button>
                                            {/* desktop toggle (hidden on mobile) */}
                                            {!isMobile && (
                                                <button className="csv-btn" onClick={() => setShowSidebar(s => !s)}>{showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}</button>
                                            )}
                                        </div>
                    </div>
                </div>

                {/* Sidebar: on mobile it's an overlay (controlled with .open) and on desktop it's fixed */}
                <div className={`sidebar-wrapper`}>
                {/* render sidebar only on non-mobile (desktop/tablet) */}
                {showSidebar && !isMobile && (
                    <aside className={`sidebar fixed-sidebar`}>
                        <h3 style={{ marginTop: 0 }}>Navigator</h3>
                        <div className="navigator-grid">
                            {available.map((q, i) => (
                                <button
                                    key={q.id}
                                    className={`nav-item ${userAnswers[q.id] !== null ? 'answered' : ''} ${flagged[q.id] ? 'flagged' : ''} ${i === currentIndex ? 'current' : ''}`}
                                    onClick={() => setCurrentIndex(i)}
                                    aria-pressed={i === currentIndex}
                                    title={`Question ${i + 1}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <button className="submit-all-btn" onClick={exportCSV}>Export CSV</button>
                        </div>
                    </aside>
                )}
                </div>

                {/* Mobile bottom-sheet navigator */}
                {isMobile && mode !== 'landing' && (
                    <>
                        <button
                            className="mobile-nav-fab"
                            onClick={() => setShowMobileNav(true)}
                            aria-label="Open navigator"
                        >
                            ☰
                        </button>

                        {showMobileNav && (
                            <div className="mobile-navigator-sheet">
                                <div className="sheet-panel">
                                    <div className="sheet-header">
                                        <strong>Navigator</strong>
                                        <button
                                            className="sheet-close"
                                            onClick={() => setShowMobileNav(false)}
                                            aria-label="Close"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="nav-grid">
                                        {available.map((q, i) => (
                                            <button
                                                key={q.id}
                                                className={`nav-item ${i === currentIndex ? 'current' : ''} ${userAnswers[q.id] !== null ? 'answered' : ''} ${flagged[q.id] ? 'flagged' : ''}`}
                                                onClick={() => { setCurrentIndex(i); setShowMobileNav(false); }}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="sheet-footer">
                                        <button onClick={() => { exportCSV(); setShowMobileNav(false); }}>
                                            Export CSV
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <main className="main-area" style={{ marginLeft: (!isMobile && showSidebar) ? 'calc(var(--sidebar-width) + 32px)' : 0, marginTop: 0 }}>
                    <div style={{ padding: 20 }}>
                        {current ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>Question {currentIndex + 1} / {available.length}</div>
                                    <div>
                                        <button onClick={toggleFlag} style={{ marginRight: 8 }}>{flagged[current.id] ? 'Unflag' : 'Flag'}</button>
                                    </div>
                                </div>

                                <h2 style={{ marginTop: 12 }}>{current.question}</h2>

                                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                    {current.options.map((opt, idx) => (
                                        <div
                                            key={idx}
                                            className={`option ${userAnswers[current.id] === idx ? 'selected' : ''}`}
                                            onClick={() => selectOption(idx)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectOption(idx); }}
                                        >
                                            {opt}
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
                                    <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} className="nav-btn">Previous</button>
                                    <button onClick={() => setCurrentIndex(i => Math.min(available.length - 1, i + 1))} className="nav-btn">Next</button>
                                </div>
                            </div>
                        ) : (
                            <div>No questions available</div>
                        )}
                    </div>
                </main>
            </div>
        );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);