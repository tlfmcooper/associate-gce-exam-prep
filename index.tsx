import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { questions, Question } from './questions';
import './styles.css';

const QUESTIONS_BY_DOMAIN = questions.reduce<Record<string, Question[]>>((acc, question) => {
    if (!acc[question.domain]) acc[question.domain] = [];
    acc[question.domain].push(question);
    return acc;
}, {});

const TOTAL_QUESTIONS = questions.length;
const MAX_QUESTION_ID = questions.reduce((max, q) => Math.max(max, q.id), 0);

const createEmptyAnswerArray = () => Array.from({ length: MAX_QUESTION_ID + 1 }, () => null as number | null);
const createEmptyFlagArray = () => Array.from({ length: MAX_QUESTION_ID + 1 }, () => false);

type DomainAllocation = { domain: string; count: number; total: number };
type PracticeSummary = {
    correct: number;
    total: number;
    answered: number;
    timeSpent: number;
    breakdown: Record<string, { correct: number; total: number; answered: number }>;
};

const calculateDomainAllocation = (requestedCount: number): DomainAllocation[] => {
    const target = Math.min(Math.max(0, requestedCount), TOTAL_QUESTIONS);
    const allocations = Object.entries(QUESTIONS_BY_DOMAIN).map(([domain, items]) => {
        const raw = (items.length / TOTAL_QUESTIONS) * target;
        const base = Math.floor(raw);
        return {
            domain,
            total: items.length,
            allocated: Math.min(base, items.length),
            remainder: raw - base,
        };
    });

    let allocatedTotal = allocations.reduce((sum, entry) => sum + entry.allocated, 0);
    const targetTotal = Math.min(target, allocations.reduce((sum, entry) => sum + entry.total, 0));

    if (allocatedTotal < targetTotal) {
        const byRemainder = [...allocations].sort((a, b) => b.remainder - a.remainder);
        let index = 0;
        while (allocatedTotal < targetTotal && byRemainder.length > 0) {
            const entry = byRemainder[index % byRemainder.length];
            if (entry.allocated < entry.total) {
                entry.allocated += 1;
                allocatedTotal += 1;
            }
            index += 1;
            if (index > byRemainder.length * 4) break;
        }
    }

    // Ensure we don't exceed target by trimming from smallest remainder if needed
    if (allocatedTotal > targetTotal) {
        const byRemainderAsc = [...allocations].sort((a, b) => a.remainder - b.remainder);
        let index = 0;
        while (allocatedTotal > targetTotal && byRemainderAsc.length > 0) {
            const entry = byRemainderAsc[index % byRemainderAsc.length];
            if (entry.allocated > 0) {
                entry.allocated -= 1;
                allocatedTotal -= 1;
            }
            index += 1;
            if (index > byRemainderAsc.length * 4) break;
        }
    }

    return allocations.map(({ domain, allocated, total }) => ({ domain, count: allocated, total }));
};

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
        const [mode, setMode] = useState<'landing' | 'practice' | 'practiceConfig' | 'exam' | 'results' | 'history' | 'practiceResults'>('landing');
    const [examSessionIds, setExamSessionIds] = useState<number[] | null>(null);
    // Practice mode states
    const [practiceSize, setPracticeSize] = useState<number>(10);
    const [customSize, setCustomSize] = useState<string>('');
    const [practiceStartTime, setPracticeStartTime] = useState<number | null>(null);
    const [userAnswers, setUserAnswers] = useState<(number | null)[]>(createEmptyAnswerArray);
    const [flagged, setFlagged] = useState<boolean[]>(createEmptyFlagArray);
    const [resultsFilter, setResultsFilter] = useState<'all' | 'correct' | 'wrong'>('all');
    const [showSubmitWarning, setShowSubmitWarning] = useState(false);
    const [pendingSubmitStats, setPendingSubmitStats] = useState<{ flagged: number; unanswered: number; answered: number; total: number } | null>(null);
    const [feedback, setFeedback] = useState<{ questionId: number; isCorrect: boolean; selectedOption: number | null } | null>(null);
    const [practiceSummary, setPracticeSummary] = useState<PracticeSummary | null>(null);
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

    const filteredQuestions = useMemo(() => {
        if (resultsFilter === 'all') return available;

        return available.filter(question => {
            const isCorrect = userAnswers[question.id] === question.correct;
            return resultsFilter === 'correct' ? isCorrect : !isCorrect;
        });
    }, [available, resultsFilter, userAnswers]);

    const current = available[currentIndex];
    const currentAnswer = current ? userAnswers[current.id] : null;

    const submissionStats = useMemo(() => {
        const total = available.length;
        let answered = 0;
        let flaggedCount = 0;

        available.forEach(question => {
            if (userAnswers[question.id] !== null) answered += 1;
            if (flagged[question.id]) flaggedCount += 1;
        });

        const unanswered = Math.max(0, total - answered);

        return {
            total,
            answered,
            unanswered,
            flagged: flaggedCount,
        };
    }, [available, userAnswers, flagged]);

    const answeredCount = submissionStats.answered;

    // Function to select N questions proportionally by domain
    const selectPracticeQuestions = (count: number): number[] => {
        // Group questions by domain
        const byDomain: { [domain: string]: number[] } = {};
        questions.forEach(q => {
            if (!byDomain[q.domain]) byDomain[q.domain] = [];
            byDomain[q.domain].push(q.id);
        });

        const domains = Object.keys(byDomain);
        const totalQuestions = questions.length;
        const selected: number[] = [];

        // Calculate questions per domain proportionally
        const questionsPerDomain = domains.map(domain => ({
            domain,
            count: Math.round((byDomain[domain].length / totalQuestions) * count),
            available: [...byDomain[domain]]
        }));

        // Adjust if rounding caused mismatch
        let currentTotal = questionsPerDomain.reduce((sum, d) => sum + d.count, 0);
        if (currentTotal < count) {
            questionsPerDomain[0].count += (count - currentTotal);
        } else if (currentTotal > count) {
            questionsPerDomain[questionsPerDomain.length - 1].count -= (currentTotal - count);
        }

        // Select random questions from each domain
        questionsPerDomain.forEach(({ available, count }) => {
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            selected.push(...shuffled.slice(0, Math.min(count, shuffled.length)));
        });

        // Shuffle final selection
        return selected.sort(() => Math.random() - 0.5);
    };

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

    // Select N questions with proportional domain distribution
    const selectProportionalQuestions = (count: number): number[] => {
        const target = Math.min(Math.max(0, count), TOTAL_QUESTIONS);
        const allocations = calculateDomainAllocation(target);
        const selected: number[] = [];

        allocations.forEach(({ domain, count }) => {
            if (count <= 0) return;
            const pool = [...(QUESTIONS_BY_DOMAIN[domain] || [])];
            const chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
            selected.push(...chosen.map(question => question.id));
        });

        if (selected.length < target) {
            const remaining = questions.filter(q => !selected.includes(q.id));
            selected.push(...shuffle(remaining).slice(0, target - selected.length).map(q => q.id));
        }

        return shuffle(selected).slice(0, target);
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

    useEffect(() => {
        if (mode !== 'practice' || !current) {
            if (mode !== 'practice') {
                setFeedback(null);
            }
            return;
        }

        if (currentAnswer === null) {
            setFeedback(null);
            return;
        }

        const isCorrect = currentAnswer === current.correct;
        setFeedback(prev => {
            if (prev && prev.questionId === current.id && prev.selectedOption === currentAnswer && prev.isCorrect === isCorrect) {
                return prev;
            }
            return {
                questionId: current.id,
                isCorrect,
                selectedOption: currentAnswer,
            };
        });
    }, [mode, current, currentAnswer]);

    const startExam = () => {
        const ids = shuffle(questions.map(q => q.id)).slice(0, Math.min(50, questions.length));
        setPracticeSummary(null);
        setPracticeStartTime(null);
        setFeedback(null);
    setShowSubmitWarning(false);
    setPendingSubmitStats(null);
        setResultsFilter('all');
        setExamSessionIds(ids);
        setUserAnswers(createEmptyAnswerArray());
        setFlagged(createEmptyFlagArray());
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
        setUserAnswers(createEmptyAnswerArray());
        setFlagged(createEmptyFlagArray());
        setPracticeSummary(null);
        setFeedback(null);
        setPracticeStartTime(null);
    setShowSubmitWarning(false);
    setPendingSubmitStats(null);
        localStorage.removeItem('examStartTime');
        localStorage.removeItem('examSessionIds');
        localStorage.removeItem('shuffledOptions');
    };

    const finalizeExamSubmission = () => {
        const totalQuestions = available.length;
        const correctCount = available.filter(q => userAnswers[q.id] === q.correct).length;
        const percentage = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
        const timeSpent = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;

        const examEntry: ExamHistoryEntry = {
            id: Date.now().toString(),
            date: Date.now(),
            score: correctCount,
            total: totalQuestions,
            percentage,
            timeSpent,
            questionIds: examSessionIds || [],
            userAnswers: [...userAnswers],
            shuffledOptions: { ...shuffledOptions }
        };

        const updatedHistory = [examEntry, ...examHistory].slice(0, 20);
        setExamHistory(updatedHistory);
        localStorage.setItem('examHistory', JSON.stringify(updatedHistory));

        setTimeRemaining(null);
        setExamStartTime(null);
        setShowTimeWarning(false);
        localStorage.removeItem('examStartTime');
        localStorage.removeItem('examSessionIds');
        localStorage.removeItem('shuffledOptions');

        setShowSubmitWarning(false);
        setPendingSubmitStats(null);

        setMode('results' as any);
    };

    const submitExam = (options?: { bypassFlagged?: boolean }) => {
        const { answered, unanswered, flagged, total } = submissionStats;

        if (answered === 0) {
            alert('You haven\'t answered any questions yet!');
            return;
        }

        if (!options?.bypassFlagged && flagged > 0) {
            setPendingSubmitStats({ flagged, unanswered, answered, total });
            setShowSubmitWarning(true);
            return;
        }

        const confirmationMessage = unanswered > 0
            ? `You have answered ${answered} of ${total} questions (${unanswered} unanswered).\n\nAre you sure you want to submit your exam?`
            : `You have answered all ${total} questions.\n\nAre you sure you want to submit your exam?`;

        const confirmed = window.confirm(confirmationMessage);
        if (!confirmed) return;

        finalizeExamSubmission();
    };

    const reviewFlaggedQuestions = () => {
        const firstFlaggedIndex = available.findIndex(q => flagged[q.id]);
        if (firstFlaggedIndex >= 0) setCurrentIndex(firstFlaggedIndex);
        setShowSubmitWarning(false);
        setPendingSubmitStats(null);
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startPractice = () => {
        setPracticeSummary(null);
        setPracticeStartTime(null);
        setFeedback(null);
        setShowSubmitWarning(false);
        setPendingSubmitStats(null);
        setResultsFilter('all');
        setExamSessionIds(null);
        setCurrentIndex(0);
        // Show practice configuration screen
        setMode('practiceConfig');
    };

    const startPracticeSession = (size: number) => {
        const targetSize = Math.min(Math.max(1, size), questions.length);
        const selectedIds = selectProportionalQuestions(targetSize);
        if (selectedIds.length === 0) {
            alert('Unable to start practice session – no questions available.');
            return;
        }

        setPracticeSummary(null);
        setExamSessionIds(selectedIds);
        setUserAnswers(createEmptyAnswerArray());
        setFlagged(createEmptyFlagArray());
        setResultsFilter('all');
        setShowSubmitWarning(false);
        setPendingSubmitStats(null);

        const shuffled = shuffleAnswerOptions(selectedIds);
        setShuffledOptions(shuffled);
        setCurrentIndex(0);
        setFeedback(null);
        setPracticeStartTime(Date.now());
        setMode('practice');
        
        // show sidebar only on larger screens
        if (typeof window !== 'undefined') setShowSidebar(window.innerWidth > 900);
    };

        const finishPractice = () => {
            if (!available.length) return;

            const unanswered = available.filter(q => userAnswers[q.id] === null).length;
            if (unanswered > 0) {
                const confirmFinish = window.confirm(`You still have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}.

Do you want to finish the practice session anyway?`);
                if (!confirmFinish) return;
            }

            const breakdown: PracticeSummary['breakdown'] = {};
            available.forEach(question => {
                if (!breakdown[question.domain]) {
                    breakdown[question.domain] = { correct: 0, total: 0, answered: 0 };
                }
                breakdown[question.domain].total += 1;
                const answer = userAnswers[question.id];
                if (answer !== null) {
                    breakdown[question.domain].answered += 1;
                    if (answer === question.correct) {
                        breakdown[question.domain].correct += 1;
                    }
                }
            });

            const totalCorrect = Object.values(breakdown).reduce((sum, entry) => sum + entry.correct, 0);
            const totalAnswered = Object.values(breakdown).reduce((sum, entry) => sum + entry.answered, 0);
            const timeSpent = practiceStartTime ? Math.floor((Date.now() - practiceStartTime) / 1000) : 0;

            setPracticeSummary({
                correct: totalCorrect,
                total: available.length,
                answered: totalAnswered,
                timeSpent,
                breakdown,
            });

            setPracticeStartTime(null);
            setFeedback(null);
            setMode('practiceResults');
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
                        submitExam({ bypassFlagged: true });
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

        if (mode === 'practice') {
            setFeedback({
                questionId: current.id,
                isCorrect: originalIdx === current.correct,
                selectedOption: originalIdx,
            });
        }
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
                                        <button onClick={() => { setMode('practiceConfig'); }} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.16)', padding: '10px 18px', borderRadius: 8, fontSize: 16 }}>Practice</button>
                                        <button onClick={() => setMode('history')} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.16)', padding: '10px 18px', borderRadius: 8, fontSize: 16 }}>📊 Exam History ({examHistory.length})</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // Practice Configuration page
            if (mode === 'practiceConfig') {
                const presetSizes = [5, 10, 20, 50];
                const selectedCount = practiceSize;
                const limitedCount = Math.min(selectedCount, questions.length);
                const domainPreview = calculateDomainAllocation(selectedCount);

                return (
                    <div className="config-container" style={{ minHeight: '100vh', padding: '40px 20px', background: 'linear-gradient(to bottom right, #1e293b, #1e40af, #1e293b)' }}>
                        <div style={{ maxWidth: 800, margin: '0 auto' }}>
                            <div style={{ 
                                background: 'rgba(51,65,85,0.95)', 
                                borderRadius: 16, 
                                padding: 40, 
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <h1 style={{ margin: '0 0 12px', fontSize: 32, color: '#f9fafb' }}>
                                    Configure Practice Session
                                </h1>
                                <p style={{ color: '#9ca3af', margin: '0 0 32px' }}>
                                    Select the number of questions for your practice set. Questions will be proportionally distributed across all domains.
                                </p>

                                <div style={{ marginBottom: 32 }}>
                                    <label style={{ color: '#f9fafb', fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 12 }}>
                                        Number of Questions
                                    </label>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                                        {presetSizes.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setPracticeSize(size)}
                                                style={{
                                                    padding: '12px 24px',
                                                    borderRadius: 8,
                                                    border: practiceSize === size ? '2px solid #1a73e8' : '2px solid rgba(255,255,255,0.2)',
                                                    background: practiceSize === size ? 'rgba(26,115,232,0.2)' : 'rgba(255,255,255,0.05)',
                                                    color: '#fff',
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            max={questions.length}
                                            value={customSize}
                                            onChange={(e) => {
                                                setCustomSize(e.target.value);
                                                const val = parseInt(e.target.value);
                                                if (val > 0 && val <= questions.length) {
                                                    setPracticeSize(val);
                                                }
                                            }}
                                            placeholder="Custom (1-500)"
                                            style={{
                                                padding: '12px',
                                                borderRadius: 8,
                                                border: '2px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#fff',
                                                fontSize: 16,
                                                width: 180
                                            }}
                                        />
                                        <span style={{ color: '#9ca3af' }}>or enter a custom number</span>
                                    </div>
                                </div>

                                <div style={{ 
                                    background: 'rgba(26,115,232,0.1)', 
                                    border: '1px solid rgba(26,115,232,0.3)',
                                    borderRadius: 12, 
                                    padding: 24, 
                                    marginBottom: 32 
                                }}>
                                    <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#f9fafb' }}>
                                        Distribution Preview ({limitedCount} questions)
                                    </h3>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        {domainPreview.map(({ domain, total, count }) => (
                                            <div key={domain} style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                gap: '12px'
                                            }}>
                                                <span style={{ color: '#e5e7eb', fontSize: 14, flex: 1 }}>{domain}</span>
                                                <span style={{ color: '#60a5fa', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {count} / {total}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={() => setMode('landing')}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: 8,
                                            border: '2px solid rgba(255,255,255,0.2)',
                                            background: 'transparent',
                                            color: '#fff',
                                            fontSize: 16,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => startPracticeSession(practiceSize)}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: '#1a73e8',
                                            color: '#fff',
                                            fontSize: 16,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Start Practice Session →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            if (mode === 'practiceResults') {
                if (!practiceSummary) {
                    return (
                        <div className="practice-results-container" style={{ minHeight: '100vh', padding: '40px 20px', background: 'linear-gradient(to bottom right, #1e293b, #1e40af, #1e293b)' }}>
                            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                                <div style={{
                                    background: 'rgba(51,65,85,0.95)',
                                    borderRadius: 16,
                                    padding: 40,
                                    textAlign: 'center',
                                    color: '#f9fafb',
                                }}>
                                    <h1 style={{ marginTop: 0 }}>Practice Summary Unavailable</h1>
                                    <p style={{ color: '#9ca3af' }}>Start a new practice session to view results.</p>
                                    <button
                                        onClick={() => setMode('landing')}
                                        style={{
                                            marginTop: 24,
                                            padding: '12px 24px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: '#1a73e8',
                                            color: '#fff',
                                            fontSize: 16,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Back to Home
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                const percentage = practiceSummary.total > 0
                    ? Math.round((practiceSummary.correct / practiceSummary.total) * 100)
                    : 0;
                const answeredPercentage = practiceSummary.total > 0
                    ? Math.round((practiceSummary.answered / practiceSummary.total) * 100)
                    : 0;
                const timeSpentFormatted = formatTime(practiceSummary.timeSpent || 0);
                const breakdownEntries = Object.entries(practiceSummary.breakdown).sort((a, b) => a[0].localeCompare(b[0]));

                return (
                    <div className="practice-results-container">
                        <div className="practice-results-inner">
                            <section className="practice-results-header">
                                <h1 className="practice-results-title">Practice Session Summary</h1>
                                <div className="practice-results-stats">
                                    <div className="practice-stat-card">
                                        <div className="practice-stat-value primary">{percentage}%</div>
                                        <div className="practice-stat-label">Overall Accuracy</div>
                                    </div>
                                    <div className="practice-stat-card">
                                        <div className="practice-stat-value">{practiceSummary.correct} / {practiceSummary.total}</div>
                                        <div className="practice-stat-label">Correct Answers</div>
                                    </div>
                                    <div className="practice-stat-card">
                                        <div className="practice-stat-value">{practiceSummary.answered} / {practiceSummary.total}</div>
                                        <div className="practice-stat-label">Answered ({answeredPercentage}%)</div>
                                    </div>
                                    <div className="practice-stat-card">
                                        <div className="practice-stat-value">{timeSpentFormatted}</div>
                                        <div className="practice-stat-label">Time Spent</div>
                                    </div>
                                </div>

                                <div className="practice-results-actions">
                                    <button
                                        onClick={() => {
                                            setMode('practice');
                                            setCurrentIndex(0);
                                            if (typeof window !== 'undefined') setShowSidebar(window.innerWidth > 900);
                                        }}
                                        className="practice-action-button secondary"
                                        type="button"
                                    >
                                        Review Questions
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPracticeSummary(null);
                                            setExamSessionIds(null);
                                            setUserAnswers(createEmptyAnswerArray());
                                            setFlagged(createEmptyFlagArray());
                                            setShuffledOptions({});
                                            setFeedback(null);
                                            setPracticeStartTime(null);
                                            setCurrentIndex(0);
                                            setMode('practiceConfig');
                                        }}
                                        className="practice-action-button primary"
                                        type="button"
                                    >
                                        Start New Practice Set →
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPracticeSummary(null);
                                            setExamSessionIds(null);
                                            setUserAnswers(createEmptyAnswerArray());
                                            setFlagged(createEmptyFlagArray());
                                            setFeedback(null);
                                            setPracticeStartTime(null);
                                            setMode('landing');
                                            setShowSidebar(false);
                                        }}
                                        className="practice-action-button tertiary"
                                        type="button"
                                    >
                                        Back to Home
                                    </button>
                                </div>
                            </section>

                            <section className="practice-results-breakdown">
                                <h2 className="practice-breakdown-title">Performance by Domain</h2>
                                <div className="practice-table-wrapper">
                                    <table className="practice-table">
                                        <thead>
                                            <tr>
                                                <th className="practice-table-header left">Domain</th>
                                                <th className="practice-table-header">Correct</th>
                                                <th className="practice-table-header">Answered</th>
                                                <th className="practice-table-header">Total</th>
                                                <th className="practice-table-header">Accuracy</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdownEntries.map(([domain, stats]) => {
                                                const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                                                const isFullCorrect = stats.correct === stats.total;
                                                return (
                                                    <tr key={domain} className={isFullCorrect ? 'full-correct' : ''}>
                                                        <td className="practice-table-cell left">{domain}</td>
                                                        <td className="practice-table-cell">{stats.correct}</td>
                                                        <td className="practice-table-cell">{stats.answered}</td>
                                                        <td className="practice-table-cell">{stats.total}</td>
                                                        <td className={`practice-table-cell ${accuracy >= 70 ? 'high-accuracy' : 'low-accuracy'}`}>{accuracy}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
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
                // If reviewing a historical exam, use stored values; otherwise calculate from current state
                const correctCount = reviewingExam ? reviewingExam.score : available.filter(q => userAnswers[q.id] === q.correct).length;
                const totalCount = reviewingExam ? reviewingExam.total : available.length;
                const wrongCount = totalCount - correctCount;
                const percentage = reviewingExam ? reviewingExam.percentage : Math.round((correctCount / totalCount) * 100);
                const passed = percentage >= 70; // Assuming 70% is passing
                const filteredCount = filteredQuestions.length;
                const filterOptions: Array<{ key: 'all' | 'correct' | 'wrong'; label: string; count: number }> = [
                    { key: 'all', label: 'All', count: totalCount },
                    { key: 'correct', label: 'Correct', count: correctCount },
                    { key: 'wrong', label: 'Wrong', count: wrongCount }
                ];

                return (
                    <div className="results-container">
                        <div className="results-inner">
                            <section className="results-header">
                                <h1 className="results-title">Exam Results</h1>
                                <div className={`results-score ${passed ? 'passed' : 'failed'}`}>{percentage}%</div>
                                <div className={`results-status ${passed ? 'passed' : 'failed'}`}>
                                    {passed ? '✓ PASSED' : '✗ FAILED'}
                                </div>
                                <p className="results-summary">
                                    You answered {correctCount} out of {totalCount} questions correctly
                                </p>
                                <div className="results-actions">
                                    {reviewingExam && (
                                        <button
                                            onClick={() => { setReviewingExam(null); setMode('history'); }}
                                            className="results-action secondary"
                                            type="button"
                                        >
                                            ← Back to History
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { clearExam(); setReviewingExam(null); setMode('landing'); }}
                                        className="results-action primary"
                                        type="button"
                                    >
                                        Back to Home
                                    </button>
                                </div>
                            </section>

                            <section className="results-breakdown">
                                <div className="results-breakdown-header">
                                    <div>
                                        <h2 className="results-subtitle">Detailed Breakdown</h2>
                                        {resultsFilter !== 'all' && (
                                            <p className="results-filter-summary">
                                                Showing {filteredCount} of {totalCount} questions
                                            </p>
                                        )}
                                    </div>
                                    <div className="results-filter-group">
                                        {filterOptions.map(option => {
                                            const isActive = resultsFilter === option.key;
                                            return (
                                                <button
                                                    key={option.key}
                                                    onClick={() => setResultsFilter(option.key)}
                                                    className={`results-filter-button${isActive ? ' active' : ''}`}
                                                    type="button"
                                                >
                                                    {option.label} ({option.count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {filteredQuestions.length === 0 ? (
                                    <div className="results-empty-state">
                                        No questions match this filter. Try a different filter to continue reviewing your results.
                                    </div>
                                ) : (
                                    filteredQuestions.map((q, filteredIdx) => {
                                        const userAnswer = userAnswers[q.id];
                                        const isCorrect = userAnswer === q.correct;
                                        const questionNumber = available.findIndex(item => item.id === q.id) + 1;

                                        return (
                                            <article
                                                key={q.id}
                                                className={`results-card ${isCorrect ? 'correct' : 'wrong'}`}
                                            >
                                                <header className="results-card-header">
                                                    <div className={`results-card-status ${isCorrect ? 'correct' : 'wrong'}`}>
                                                        {isCorrect ? '✓' : '✗'}
                                                    </div>
                                                    <div className="results-card-meta">
                                                        <span>
                                                            Question {questionNumber} of {totalCount}
                                                        </span>
                                                        {resultsFilter !== 'all' && (
                                                            <span className="results-card-filter-index">
                                                                Filter {filteredIdx + 1} of {filteredCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </header>

                                                <div className="results-card-domain">
                                                    <span className="domain-badge">{q.domain}</span>
                                                </div>

                                                <h3 className="results-card-title">
                                                    {q.question}
                                                </h3>

                                                <div className="results-card-options">
                                                    {q.options.map((opt, optIdx) => {
                                                        const isUserAnswer = userAnswer === optIdx;
                                                        const isCorrectAnswer = q.correct === optIdx;

                                                        return (
                                                            <div
                                                                key={optIdx}
                                                                className={`results-card-option${isCorrectAnswer ? ' correct' : ''}${isUserAnswer && !isCorrectAnswer ? ' incorrect' : ''}`}
                                                            >
                                                                <div className="results-card-option-label">
                                                                    {isCorrectAnswer && <span className="results-card-chip correct">✓ Correct</span>}
                                                                    {isUserAnswer && !isCorrectAnswer && <span className="results-card-chip incorrect">✗ Your Answer</span>}
                                                                    <span>{opt}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="results-card-explanation primary">
                                                    <div className="results-card-explanation-title">ℹ️ Explanation:</div>
                                                    <div>{q.explanation}</div>
                                                </div>

                                                {!isCorrect && userAnswer !== null && q.wrongExplanations && q.wrongExplanations[userAnswer] && (
                                                    <div className="results-card-explanation warning">
                                                        <div className="results-card-explanation-title">⚠️ Why your answer was wrong:</div>
                                                        <div>{q.wrongExplanations[userAnswer]}</div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })
                                )}
                            </section>
                        </div>
                    </div>
                );
            }

        return (
            <div className="app-layout">
                {showSubmitWarning && pendingSubmitStats && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="submit-warning-title"
                        className="modal-overlay"
                    >
                        <div className="modal-content" role="document">
                            <h3 id="submit-warning-title" className="modal-title">
                                Review Flagged Questions?
                            </h3>
                            <p className="modal-text">
                                You have {pendingSubmitStats.flagged} flagged question{pendingSubmitStats.flagged === 1 ? '' : 's'}.
                            </p>
                            <p className="modal-text">
                                You have answered {pendingSubmitStats.answered} of {pendingSubmitStats.total} questions so far.
                            </p>
                            {pendingSubmitStats.unanswered > 0 && (
                                <p className="modal-text">
                                    There {pendingSubmitStats.unanswered === 1 ? 'is' : 'are'} also {pendingSubmitStats.unanswered} unanswered question{pendingSubmitStats.unanswered === 1 ? '' : 's'} remaining.
                                </p>
                            )}
                            <p className="modal-text muted">
                                You can jump back to the first flagged question to review or submit now and view the full breakdown in the results screen.
                            </p>
                            <div className="modal-actions">
                                <button
                                    onClick={reviewFlaggedQuestions}
                                    className="modal-button secondary"
                                    type="button"
                                >
                                    Review Flagged Questions
                                </button>
                                <button
                                    onClick={finalizeExamSubmission}
                                    className="modal-button primary"
                                    type="button"
                                >
                                    Submit Anyway
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* top banner only when not on landing */}
                <div className="exam-banner fixed-banner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ fontWeight: 700 }}>
                                {mode === 'exam'
                                    ? `Exam — ${available.length} questions`
                                    : mode === 'practice'
                                        ? `Practice — ${available.length} questions`
                                        : 'Practice'}
                            </div>
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
                            {mode === 'practice' && (
                                <div style={{
                                    fontWeight: 600,
                                    fontSize: 16,
                                    color: '#bfdbfe',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    background: 'rgba(96,165,250,0.12)',
                                }}>
                                    Progress: {answeredCount}/{available.length} answered
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {mode === 'exam' && (
                                <button 
                                    className="submit-btn" 
                                    onClick={() => submitExam()}
                                    style={{ 
                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(74,222,128,0.9))',
                                        fontWeight: 600
                                    }}
                                >
                                    Submit Exam ({available.filter(q => userAnswers[q.id] !== null).length}/{available.length})
                                </button>
                            )}
                            {mode === 'practice' && (
                                <button
                                    className="csv-btn"
                                    onClick={finishPractice}
                                    style={{ fontWeight: 600 }}
                                >
                                    Finish Practice ({answeredCount}/{available.length})
                                </button>
                            )}
                            {mode !== 'exam' && (
                                <button className="csv-btn" onClick={() => { startExam(); setShowSidebar(typeof window !== 'undefined' ? window.innerWidth > 900 : true); }}>Start 50-Question Exam</button>
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

                                {mode === 'practice' && feedback && feedback.questionId === current.id && (
                                    <div
                                        style={{
                                            marginTop: 20,
                                            padding: '16px 18px',
                                            borderRadius: 10,
                                            border: `1px solid ${feedback.isCorrect ? 'rgba(52,211,153,0.45)' : 'rgba(248,113,113,0.45)'}`,
                                            background: feedback.isCorrect ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                                        }}
                                    >
                                        <div style={{ fontWeight: 700, color: feedback.isCorrect ? '#34d399' : '#f87171', marginBottom: 8 }}>
                                            {feedback.isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                                        </div>
                                        <div style={{ color: '#e5e7eb', marginBottom: 6 }}>
                                            Your answer: <strong>{feedback.selectedOption !== null ? current.options[feedback.selectedOption] : '—'}</strong>
                                        </div>
                                        <div style={{ color: '#bfdbfe', marginBottom: 10 }}>
                                            Correct answer: <strong>{current.options[current.correct]}</strong>
                                        </div>
                                        <div style={{ color: '#e5e7eb', lineHeight: 1.6, marginBottom: feedback.isCorrect ? 0 : 10 }}>
                                            {current.explanation}
                                        </div>
                                        {!feedback.isCorrect && feedback.selectedOption !== null && current.wrongExplanations && current.wrongExplanations[feedback.selectedOption] && (
                                            <div style={{
                                                marginTop: 10,
                                                padding: '12px 14px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(248,113,113,0.35)',
                                                background: 'rgba(248,113,113,0.1)',
                                                color: '#fecaca',
                                            }}>
                                                {current.wrongExplanations[feedback.selectedOption]}
                                            </div>
                                        )}
                                    </div>
                                )}

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