import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { questions, Question } from './questions';
import './styles.css';

const App: React.FC = () => {
    const [showSidebar, setShowSidebar] = useState(true);
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
    };

    const clearExam = () => {
        setExamSessionIds(null);
        setCurrentIndex(0);
    };

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

    return (
        <div className="app-layout">
            <div className="exam-banner fixed-banner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>GCE Practice — {examSessionIds ? `${available.length} question session` : 'Practice'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="csv-btn" onClick={startExam}>Start 50-Question Exam</button>
                        <button className="csv-btn" onClick={clearExam}>Clear Session</button>
                        <button className="csv-btn" onClick={() => setShowSidebar(s => !s)}>{showSidebar ? 'Hide' : 'Show'} Sidebar</button>
                    </div>
                </div>
            </div>

            {showSidebar && (
                <aside className="sidebar fixed-sidebar">
                    <h3 style={{ marginTop: 0 }}>Navigator</h3>
                    <div className="navigator-grid">
                        {available.map((q, i) => (
                            <button
                                key={q.id}
                                className={`nav-item ${userAnswers[q.id] !== null ? 'answered' : ''} ${flagged[q.id] ? 'flagged' : ''}`}
                                onClick={() => setCurrentIndex(i)}
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

            <main className="main-area" style={{ marginLeft: showSidebar ? 240 : 0, marginTop: 70 }}>
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
                                        className="option"
                                        onClick={() => selectOption(idx)}
                                        style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: userAnswers[current.id] === idx ? '#e8f0fe' : '#fff' }}
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