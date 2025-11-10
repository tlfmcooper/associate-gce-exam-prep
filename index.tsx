import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { questions, Question } from './questions';
import './styles.css';

interface ExamHistoryEntry {
    id: string;
    date: number;
    score: number;
    total: number;
    percentage: number;
    timeSpent: number; // in seconds
    questionIds: number[];
    userAnswers: (number | null)[];
    shuffledOptions: { [key: number]: number[] };
}

const App: React.FC = () => {
        const [showSidebar, setShowSidebar] = useState(true);
        const [isMobile, setIsMobile] = useState(false);
        const [showMobileNav, setShowMobileNav] = useState(false);
        const [mode, setMode] = useState<'landing' | 'practice' | 'exam' | 'results' | 'history'>('landing');
    const [examSessionIds, setExamSessionIds] = useState<number[] | null>(null);
    const [userAnswers, setUserAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
    const [flagged, setFlagged] = useState<boolean[]>(() => new Array(questions.length).fill(false));
    const [currentIndex, setCurrentIndex] = useState(0);
    // Store shuffled options mapping: questionId -> [shuffled indices]
    const [shuffledOptions, setShuffledOptions] = useState<{ [key: number]: number[] }>({});
    // Timer state (in seconds, 2 hours = 7200 seconds)
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [showTimeWarning, setShowTimeWarning] = useState(false);
    const [examStartTime, setExamStartTime] = useState<number | null>(null);
    // Exam history
    const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>([]);
    const [reviewingExam, setReviewingExam] = useState<ExamHistoryEntry | null>(null);

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

    const shuffleAnswerOptions = (questionIds: number[]) => {
        const mapping: { [key: number]: number[] } = {};
        questionIds.forEach(id => {
            const question = questions.find(q => q.id === id);
            if (question) {
                // Create array of indices [0, 1, 2, 3...]
                const indices = Array.from({ length: question.options.length }, (_, i) => i);
                // Shuffle the indices
                mapping[id] = shuffle(indices);
            }
        });
        return mapping;
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
        // Shuffle answer options for exam
        const shuffled = shuffleAnswerOptions(ids);
        setShuffledOptions(shuffled);
        setCurrentIndex(0);
        
        // Initialize timer (2 hours = 7200 seconds)
        const startTime = Date.now();
        setExamStartTime(startTime);
        setTimeRemaining(7200);
        setShowTimeWarning(false);
        
        // Save to localStorage
        localStorage.setItem('examStartTime', startTime.toString());
        localStorage.setItem('examSessionIds', JSON.stringify(ids));
        localStorage.setItem('shuffledOptions', JSON.stringify(shuffled));
        
            setMode('exam');
            // hide sidebar on small screens for better mobile UX
            if (typeof window !== 'undefined') setShowSidebar(window.innerWidth > 900);
    };

    const clearExam = () => {
        setExamSessionIds(null);
        setCurrentIndex(0);
        setTimeRemaining(null);
        setExamStartTime(null);
        setShuffledOptions({});
        localStorage.removeItem('examStartTime');
        localStorage.removeItem('examSessionIds');
        localStorage.removeItem('shuffledOptions');
    };

    const submitExam = () => {
        // Count answered questions
        const answeredCount = available.filter(q => userAnswers[q.id] !== null).length;
        
        if (answeredCount === 0) {
            alert('You haven\'t answered any questions yet!');
            return;
        }

        const confirmed = window.confirm(
            `You have answered ${answeredCount} of ${available.length} questions.\n\nAre you sure you want to submit your exam?`
        );

        if (!confirmed) return;

        // Calculate score
        const correctCount = available.filter(q => userAnswers[q.id] === q.correct).length;
        const percentage = Math.round((correctCount / available.length) * 100);
        
        // Calculate time spent
        const timeSpent = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;
        
        // Create exam history entry
        const examEntry: ExamHistoryEntry = {
            id: Date.now().toString(),
            date: Date.now(),
            score: correctCount,
            total: available.length,
            percentage,
            timeSpent,
            questionIds: examSessionIds || [],
            userAnswers: [...userAnswers],
            shuffledOptions: { ...shuffledOptions }
        };
        
        // Save to history (keep last 20)
        const updatedHistory = [examEntry, ...examHistory].slice(0, 20);
        setExamHistory(updatedHistory);
        localStorage.setItem('examHistory', JSON.stringify(updatedHistory));

        // Clear timer and exam state
        setTimeRemaining(null);
        localStorage.removeItem('examStartTime');
        localStorage.removeItem('examSessionIds');
        localStorage.removeItem('shuffledOptions');
        
        // Switch to results mode
        setMode('results' as any);
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

        const startPractice = () => {
            // clear any exam session and switch to practice mode
            setExamSessionIds(null);
            // Shuffle answer options for practice mode too
            const allIds = questions.map(q => q.id);
            setShuffledOptions(shuffleAnswerOptions(allIds));
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

        // Timer effect for exam mode
        useEffect(() => {
            if (mode !== 'exam' || timeRemaining === null) return;

            const interval = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev === null || prev <= 0) {
                        clearInterval(interval);
                        // Auto-submit exam when timer reaches zero
                        alert('Time is up! Your exam will now be submitted.');
                        submitExam();
                        return 0;
                    }

                    // Show warning at 15 minutes (900 seconds)
                    if (prev === 900 && !showTimeWarning) {
                        setShowTimeWarning(true);
                        alert('Warning: Only 15 minutes remaining!');
                    }

                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }, [mode, timeRemaining, showTimeWarning]);

        // Load exam history from localStorage on mount
        useEffect(() => {
            const savedHistory = localStorage.getItem('examHistory');
            if (savedHistory) {
                try {
                    const history = JSON.parse(savedHistory) as ExamHistoryEntry[];
                    setExamHistory(history);
                } catch (e) {
                    console.error('Failed to load exam history', e);
                }
            }
        }, []);

        // Restore exam state from localStorage on mount
        useEffect(() => {
            const savedStartTime = localStorage.getItem('examStartTime');
            const savedSessionIds = localStorage.getItem('examSessionIds');
            const savedShuffledOptions = localStorage.getItem('shuffledOptions');
            
            if (savedStartTime && savedSessionIds && mode === 'exam') {
                const startTime = parseInt(savedStartTime);
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = Math.max(0, 7200 - elapsed);
                
                if (remaining > 0) {
                    setTimeRemaining(remaining);
                    setExamStartTime(startTime);
                    
                    // Restore shuffled options
                    if (savedShuffledOptions) {
                        try {
                            setShuffledOptions(JSON.parse(savedShuffledOptions));
                        } catch (e) {
                            console.error('Failed to restore shuffled options', e);
                        }
                    }
                } else {
                    // Exam time expired
                    localStorage.removeItem('examStartTime');
                    localStorage.removeItem('examSessionIds');
                    localStorage.removeItem('shuffledOptions');
                }
            }
        }, []);

    const selectOption = (displayIdx: number) => {
        if (!current) return;
        // Map displayed index back to original index
        const shuffleMap = shuffledOptions[current.id];
        const originalIdx = shuffleMap ? shuffleMap[displayIdx] : displayIdx;
        
        const copy = [...userAnswers];
        copy[current.id] = originalIdx;
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

                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                                        <button onClick={() => { startExam(); setShowSidebar(true); }} style={{ background: '#1a73e8', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 8, fontSize: 16 }}>Start New Exam →</button>
                                        <button onClick={() => { startPractice(); }} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.16)', padding: '10px 18px', borderRadius: 8, fontSize: 16 }}>Practice</button>
                                        <button onClick={() => setMode('history')} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.16)', padding: '10px 18px', borderRadius: 8, fontSize: 16 }}>📊 Exam History ({examHistory.length})</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // Exam History page
            if (mode === 'history') {
                return (
                    <div className="history-container" style={{ minHeight: '100vh', padding: '40px 20px', background: 'linear-gradient(to bottom right, #1e293b, #1e40af, #1e293b)' }}>
                        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                            <div style={{ 
                                background: 'rgba(51,65,85,0.95)', 
                                borderRadius: 16, 
                                padding: 32, 
                                marginBottom: 32,
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <h1 style={{ margin: 0, fontSize: 32, color: '#f9fafb' }}>
                                        📊 Exam History
                                    </h1>
                                    <button 
                                        onClick={() => setMode('landing')}
                                        className="nav-btn"
                                    >
                                        Back to Home
                                    </button>
                                </div>
                                <p style={{ color: '#9ca3af', margin: 0 }}>
                                    Review your past {examHistory.length} exam attempt{examHistory.length !== 1 ? 's' : ''} (showing last 20)
                                </p>
                            </div>

                            {examHistory.length === 0 ? (
                                <div style={{ 
                                    background: 'rgba(51,65,85,0.95)', 
                                    borderRadius: 16, 
                                    padding: 64, 
                                    textAlign: 'center',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                                    <h2 style={{ color: '#f9fafb', marginBottom: 8 }}>No Exam History Yet</h2>
                                    <p style={{ color: '#9ca3af', marginBottom: 24 }}>Complete an exam to see your results here</p>
                                    <button 
                                        onClick={() => { startExam(); setShowSidebar(true); }}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(96,165,250,0.9))',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '12px 24px',
                                            borderRadius: 8,
                                            fontSize: 16,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Start Your First Exam
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {examHistory.map((exam, idx) => {
                                        const passed = exam.percentage >= 70;
                                        const date = new Date(exam.date);
                                        const timeSpentFormatted = formatTime(exam.timeSpent);
                                        
                                        return (
                                            <div 
                                                key={exam.id}
                                                style={{ 
                                                    background: 'rgba(51,65,85,0.95)',
                                                    borderRadius: 12,
                                                    padding: 24,
                                                    backdropFilter: 'blur(12px)',
                                                    border: `2px solid ${passed ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.2s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                onClick={() => {
                                                    // Load this exam for review
                                                    setReviewingExam(exam);
                                                    setExamSessionIds(exam.questionIds);
                                                    setUserAnswers(exam.userAnswers);
                                                    setShuffledOptions(exam.shuffledOptions);
                                                    setCurrentIndex(0);
                                                    setMode('results');
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                                            <div style={{ 
                                                                fontSize: 32, 
                                                                fontWeight: 800,
                                                                color: passed ? '#34d399' : '#f87171'
                                                            }}>
                                                                {exam.percentage}%
                                                            </div>
                                                            <div style={{ 
                                                                padding: '4px 12px',
                                                                borderRadius: 6,
                                                                fontSize: 14,
                                                                fontWeight: 600,
                                                                background: passed ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                                                                color: passed ? '#34d399' : '#f87171'
                                                            }}>
                                                                {passed ? 'PASSED' : 'FAILED'}
                                                            </div>
                                                        </div>
                                                        <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                                                            Score: {exam.score}/{exam.total} questions correct
                                                        </div>
                                                        <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                                                            Time: {timeSpentFormatted}
                                                        </div>
                                                        <div style={{ color: '#9ca3af', fontSize: 14 }}>
                                                            Date: {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Load this exam for review
                                                                setReviewingExam(exam);
                                                                setExamSessionIds(exam.questionIds);
                                                                setUserAnswers(exam.userAnswers);
                                                                setShuffledOptions(exam.shuffledOptions);
                                                                setCurrentIndex(0);
                                                                setMode('results');
                                                            }}
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(96,165,250,0.9))',
                                                                color: '#fff',
                                                                border: 'none',
                                                                padding: '10px 20px',
                                                                borderRadius: 8,
                                                                fontSize: 14,
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Review →
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            // Results page
            if (mode === 'results') {
                const correctCount = available.filter(q => userAnswers[q.id] === q.correct).length;
                const totalCount = available.length;
                const percentage = Math.round((correctCount / totalCount) * 100);
                const passed = percentage >= 70; // Assuming 70% is passing

                return (
                    <div className="results-container" style={{ minHeight: '100vh', padding: '40px 20px', background: 'linear-gradient(to bottom right, #1e293b, #1e40af, #1e293b)' }}>
                        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                            {/* Results Header */}
                            <div className="results-header" style={{ 
                                background: 'rgba(51,65,85,0.95)', 
                                borderRadius: 16, 
                                padding: 40, 
                                marginBottom: 32,
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                            }}>
                                <h1 style={{ margin: 0, fontSize: 36, color: '#f9fafb', textAlign: 'center' }}>
                                    Exam Results
                                </h1>
                                <div style={{ 
                                    marginTop: 24, 
                                    textAlign: 'center', 
                                    fontSize: 72, 
                                    fontWeight: 800,
                                    color: passed ? '#34d399' : '#f87171'
                                }}>
                                    {percentage}%
                                </div>
                                <div style={{ 
                                    marginTop: 16, 
                                    textAlign: 'center', 
                                    fontSize: 24, 
                                    fontWeight: 600,
                                    color: passed ? '#34d399' : '#f87171'
                                }}>
                                    {passed ? '✓ PASSED' : '✗ FAILED'}
                                </div>
                                <div style={{ 
                                    marginTop: 16, 
                                    textAlign: 'center', 
                                    fontSize: 18, 
                                    color: '#9ca3af' 
                                }}>
                                    You answered {correctCount} out of {totalCount} questions correctly
                                </div>
                                <div style={{ marginTop: 32, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center' }}>
                                    {reviewingExam && (
                                        <button 
                                            onClick={() => { setReviewingExam(null); setMode('history'); }}
                                            style={{
                                                background: 'transparent',
                                                color: '#60a5fa',
                                                border: '2px solid rgba(96,165,250,0.5)',
                                                padding: '14px 32px',
                                                borderRadius: 8,
                                                fontSize: 16,
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ← Back to History
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { clearExam(); setReviewingExam(null); setMode('landing'); }}
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(96,165,250,0.9))',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '14px 32px',
                                            borderRadius: 8,
                                            fontSize: 16,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Back to Home
                                    </button>
                                </div>
                            </div>

                            {/* Question by Question Breakdown */}
                            <div className="results-breakdown">
                                <h2 style={{ fontSize: 24, color: '#f9fafb', marginBottom: 24 }}>
                                    Detailed Breakdown
                                </h2>
                                {available.map((q, idx) => {
                                    const userAnswer = userAnswers[q.id];
                                    const isCorrect = userAnswer === q.correct;
                                    const shuffleMap = shuffledOptions[q.id] || [];
                                    
                                    return (
                                        <div 
                                            key={q.id} 
                                            style={{ 
                                                background: 'rgba(51,65,85,0.95)',
                                                borderRadius: 12,
                                                padding: 24,
                                                marginBottom: 24,
                                                backdropFilter: 'blur(12px)',
                                                border: `2px solid ${isCorrect ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                                <div style={{ 
                                                    fontSize: 24, 
                                                    fontWeight: 700,
                                                    color: isCorrect ? '#34d399' : '#f87171'
                                                }}>
                                                    {isCorrect ? '✓' : '✗'}
                                                </div>
                                                <div style={{ fontSize: 14, color: '#9ca3af' }}>
                                                    Question {idx + 1} of {totalCount}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: 12 }}>
                                                <span className="domain-badge" style={{ fontSize: 12 }}>{q.domain}</span>
                                            </div>

                                            <h3 style={{ fontSize: 18, color: '#f9fafb', marginBottom: 16, lineHeight: 1.5 }}>
                                                {q.question}
                                            </h3>

                                            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                                                {q.options.map((opt, optIdx) => {
                                                    const isUserAnswer = userAnswer === optIdx;
                                                    const isCorrectAnswer = q.correct === optIdx;
                                                    
                                                    return (
                                                        <div
                                                            key={optIdx}
                                                            style={{
                                                                padding: '12px 16px',
                                                                borderRadius: 8,
                                                                border: `2px solid ${
                                                                    isCorrectAnswer 
                                                                        ? 'rgba(52,211,153,0.6)' 
                                                                        : isUserAnswer 
                                                                            ? 'rgba(248,113,113,0.6)' 
                                                                            : 'rgba(255,255,255,0.1)'
                                                                }`,
                                                                background: isCorrectAnswer 
                                                                    ? 'rgba(52,211,153,0.1)' 
                                                                    : isUserAnswer 
                                                                        ? 'rgba(248,113,113,0.1)' 
                                                                        : 'rgba(51,65,85,0.5)',
                                                                color: '#f9fafb'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                {isCorrectAnswer && <span style={{ color: '#34d399', fontWeight: 600 }}>✓ Correct</span>}
                                                                {isUserAnswer && !isCorrectAnswer && <span style={{ color: '#f87171', fontWeight: 600 }}>✗ Your Answer</span>}
                                                                <span>{opt}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Explanations */}
                                            <div style={{ 
                                                background: 'rgba(59,130,246,0.1)', 
                                                border: '1px solid rgba(59,130,246,0.2)',
                                                borderRadius: 8, 
                                                padding: 16, 
                                                marginBottom: 12 
                                            }}>
                                                <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>
                                                    ℹ️ Explanation:
                                                </div>
                                                <div style={{ color: '#e5e7eb', lineHeight: 1.6 }}>
                                                    {q.explanation}
                                                </div>
                                            </div>

                                            {!isCorrect && userAnswer !== null && q.wrongExplanations && q.wrongExplanations[userAnswer] && (
                                                <div style={{ 
                                                    background: 'rgba(248,113,113,0.1)', 
                                                    border: '1px solid rgba(248,113,113,0.2)',
                                                    borderRadius: 8, 
                                                    padding: 16 
                                                }}>
                                                    <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 8 }}>
                                                        ⚠️ Why your answer was wrong:
                                                    </div>
                                                    <div style={{ color: '#e5e7eb', lineHeight: 1.6 }}>
                                                        {q.wrongExplanations[userAnswer]}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }

        return (
            <div className="app-layout">
                {/* top banner only when not on landing */}
                <div className="exam-banner fixed-banner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ fontWeight: 700 }}>{mode === 'exam' ? `Exam — ${available.length} questions` : 'Practice'}</div>
                            {mode === 'exam' && timeRemaining !== null && (
                                <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: 18, 
                                    color: timeRemaining < 900 ? '#f87171' : '#60a5fa',
                                    padding: '4px 12px',
                                    borderRadius: 8,
                                    background: timeRemaining < 900 ? 'rgba(248,113,113,0.1)' : 'rgba(96,165,250,0.1)'
                                }}>
                                    ⏱️ {formatTime(timeRemaining)}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {mode === 'exam' && (
                                <button 
                                    className="submit-btn" 
                                    onClick={submitExam}
                                    style={{ 
                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(74,222,128,0.9))',
                                        fontWeight: 600
                                    }}
                                >
                                    Submit Exam ({available.filter(q => userAnswers[q.id] !== null).length}/{available.length})
                                </button>
                            )}
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
                                {/* Domain and subdomain badges */}
                                <div style={{ marginBottom: 16 }}>
                                    <span className="domain-badge">{current.domain}</span>
                                    {current.subdomain && (
                                        <div style={{ marginTop: 8, fontSize: 14, color: '#9ca3af' }}>
                                            {current.subdomain}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <div style={{ fontSize: 14, color: '#9ca3af' }}>Question {currentIndex + 1} of {available.length}</div>
                                    <button 
                                        onClick={toggleFlag} 
                                        className={`flag-button ${flagged[current.id] ? 'flagged' : ''}`}
                                    >
                                        🚩 {flagged[current.id] ? 'Flagged' : 'Flag'}
                                    </button>
                                </div>

                                <h2 style={{ marginTop: 0, fontSize: 22, lineHeight: 1.5, color: '#f9fafb', fontWeight: 500 }}>{current.question}</h2>

                                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                    {(() => {
                                        // Get shuffled order for this question
                                        const shuffleMap = shuffledOptions[current.id];
                                        const orderedOptions = shuffleMap 
                                            ? shuffleMap.map(originalIdx => current.options[originalIdx])
                                            : current.options;
                                        
                                        return orderedOptions.map((opt, displayIdx) => {
                                            // Determine if this option is selected
                                            const originalIdx = shuffleMap ? shuffleMap[displayIdx] : displayIdx;
                                            const isSelected = userAnswers[current.id] === originalIdx;
                                            
                                            return (
                                                <div
                                                    key={displayIdx}
                                                    className={`option ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => selectOption(displayIdx)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectOption(displayIdx); }}
                                                >
                                                    {opt}
                                                </div>
                                            );
                                        });
                                    })()}
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