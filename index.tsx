import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { questions, Question } from './questions';

const App: React.FC = () => {
    const [selectedDomain, setSelectedDomain] = useState<string>('All');
    const [selectedSubdomain, setSelectedSubdomain] = useState<string>('All');

    const domains = useMemo(() => ['All', ...Array.from(new Set(questions.map(q => q.domain)))], []);
    
    const subdomains = useMemo(() => {
        if (selectedDomain === 'All') {
            return ['All'];
        }
        return ['All', ...Array.from(new Set(questions.filter(q => q.domain === selectedDomain).map(q => q.subdomain)))];
    }, [selectedDomain]);

    const filteredQuestions = useMemo(() => {
        return questions
            .filter(q => selectedDomain === 'All' || q.domain === selectedDomain)
            .filter(q => selectedSubdomain === 'All' || q.subdomain === selectedSubdomain);
    }, [selectedDomain, selectedSubdomain]);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [userAnswers, setUserAnswers] = useState<(number | null)[]>(new Array(filteredQuestions.length).fill(null));
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showResult, setShowResult] = useState<boolean>(false);
    
    useEffect(() => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setShowResult(false);
        setUserAnswers(new Array(filteredQuestions.length).fill(null));
    }, [filteredQuestions.length]);


    const currentQuestion: Question | undefined = useMemo(() => filteredQuestions[currentQuestionIndex], [currentQuestionIndex, filteredQuestions]);

    const handleOptionSelect = (index: number) => {
        if (showResult) return;
        setSelectedOption(index);
    };

    const handleSubmit = () => {
        if (selectedOption === null) return;
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = selectedOption;
        setUserAnswers(newAnswers);
        setShowResult(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < filteredQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setShowResult(false);
        }
    };
    
    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
            setSelectedOption(null);
            setShowResult(false);
        }
    };

    const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDomain(e.target.value);
        setSelectedSubdomain('All');
    };

    const handleSubdomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSubdomain(e.target.value);
    };

    const renderExplanation = () => {
        if (!showResult || !currentQuestion) return null;

        const isCorrect = selectedOption === currentQuestion.correct;
        const explanationHeader = isCorrect ? "Correct!" : "Incorrect";
        const explanationColor = isCorrect ? styles.correctText : styles.incorrectText;
        
        return (
            <div style={styles.explanationContainer}>
                <h3 style={{...styles.explanationHeader, ...explanationColor}}>{explanationHeader}</h3>
                <p style={styles.explanationText}><strong>Explanation:</strong> {currentQuestion.explanation}</p>
                <h4 style={styles.wrongExplanationHeader}>Why other options are incorrect:</h4>
                <ul>
                    {currentQuestion.options.map((_, index) => {
                        if (index !== currentQuestion.correct && currentQuestion.wrongExplanations[index] !== undefined) {
                            return (
                                <li key={index} style={styles.explanationText}>
                                    <strong>Option {index + 1}:</strong> {currentQuestion.wrongExplanations[index]}
                                </li>
                            );
                        }
                        return null;
                    })}
                </ul>
            </div>
        );
    };

    const getOptionStyle = (index: number) => {
        if (!showResult || !currentQuestion) {
            return selectedOption === index ? {...styles.option, ...styles.selectedOption} : styles.option;
        }
        if (index === currentQuestion.correct) {
            return {...styles.option, ...styles.correctOption};
        }
        if (index === selectedOption && index !== currentQuestion.correct) {
            return {...styles.option, ...styles.incorrectOption};
        }
        return styles.option;
    };
    
    const progress = filteredQuestions.length > 0 ? ((currentQuestionIndex + 1) / filteredQuestions.length) * 100 : 0;

    const isPrevDisabled = currentQuestionIndex === 0;
    const isNextDisabled = currentQuestionIndex >= filteredQuestions.length - 1;
    const isSubmitDisabled = selectedOption === null;

    return (
        <div style={styles.appContainer}>
            <header style={styles.header}>
                <h1 style={styles.title}>GCP Associate Cloud Engineer Practice Exam</h1>
            </header>

            <div style={styles.filterContainer}>
                <select value={selectedDomain} onChange={handleDomainChange} style={styles.filterSelect} aria-label="Filter by domain">
                    {domains.map(domain => <option key={domain} value={domain}>{domain}</option>)}
                </select>
                <select value={selectedSubdomain} onChange={handleSubdomainChange} style={styles.filterSelect} disabled={selectedDomain === 'All'} aria-label="Filter by subdomain">
                    {subdomains.map(subdomain => <option key={subdomain} value={subdomain}>{subdomain}</option>)}
                </select>
            </div>

            <div style={styles.progressBarContainer}>
                <div style={{...styles.progressBar, width: `${progress}%`}}></div>
            </div>

            <main style={styles.mainContent}>
                {currentQuestion ? (
                    <>
                        <div style={styles.questionHeader}>
                            <p style={styles.questionCount}>Question {currentQuestionIndex + 1} of {filteredQuestions.length}</p>
                            <p style={styles.domainText}>{currentQuestion.domain}</p>
                        </div>
                        <h2 style={styles.questionText}>{currentQuestion.question}</h2>
                        <div style={styles.optionsContainer}>
                            {currentQuestion.options.map((option, index) => (
                                <div
                                    key={index}
                                    style={getOptionStyle(index)}
                                    onClick={() => handleOptionSelect(index)}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={selectedOption === index}
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                        {renderExplanation()}
                        <div style={styles.navigation}>
                            <button 
                                style={isPrevDisabled ? {...styles.navButton, ...styles.disabledButton} : styles.navButton} 
                                onClick={handlePrevious} 
                                disabled={isPrevDisabled}
                            >
                                Previous
                            </button>
                            {!showResult && 
                                <button 
                                    style={isSubmitDisabled ? {...styles.submitButton, ...styles.disabledButton} : styles.submitButton} 
                                    onClick={handleSubmit} 
                                    disabled={isSubmitDisabled}
                                >
                                    Submit
                                </button>
                            }
                            {showResult && 
                                <button 
                                    style={isNextDisabled ? {...styles.navButton, ...styles.disabledButton} : styles.navButton} 
                                    onClick={handleNext} 
                                    disabled={isNextDisabled}
                                >
                                    Next
                                </button>
                            }
                        </div>
                    </>
                ) : (
                    <div style={styles.noQuestionsContainer}>
                        <p>No questions found for the selected filters. Please broaden your selection.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    appContainer: { maxWidth: '800px', width: '100%', margin: '0 auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' },
    header: { backgroundColor: '#4285F4', color: 'white', padding: '20px', textAlign: 'center' },
    title: { margin: 0, fontSize: '1.5em' },
    filterContainer: { display: 'flex', gap: '15px', padding: '15px 30px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dadce0' },
    filterSelect: { flex: 1, padding: '10px', fontSize: '0.9em', borderRadius: '4px', border: '1px solid #dadce0' },
    progressBarContainer: { width: '100%', backgroundColor: '#e0e0e0' },
    progressBar: { height: '8px', backgroundColor: '#34A853', transition: 'width 0.3s ease-in-out' },
    mainContent: { padding: '30px' },
    questionHeader: { display: 'flex', justifyContent: 'space-between', color: '#5f6368', marginBottom: '15px', fontSize: '0.9em' },
    questionCount: {},
    domainText: { fontStyle: 'italic' },
    questionText: { fontSize: '1.2em', lineHeight: '1.6', color: '#202124', marginBottom: '25px' },
    optionsContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
    option: { padding: '15px', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#3c4043' },
    selectedOption: { borderColor: '#4285F4', backgroundColor: '#e8f0fe', borderWidth: '2px' },
    correctOption: { backgroundColor: '#e6f4ea', borderColor: '#34A853', color: '#1e8e3e', borderWidth: '2px' },
    incorrectOption: { backgroundColor: '#fce8e6', borderColor: '#d93025', color: '#a50e0e', borderWidth: '2px' },
    explanationContainer: { marginTop: '30px', padding: '20px', borderTop: '1px solid #dadce0' },
    explanationHeader: { marginTop: 0, fontSize: '1.3em' },
    correctText: { color: '#1e8e3e' },
    incorrectText: { color: '#a50e0e' },
    explanationText: { color: '#3c4043', lineHeight: '1.6' },
    wrongExplanationHeader: { marginTop: '20px', color: '#202124' },
    navigation: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', borderTop: '1px solid #dadce0', paddingTop: '20px' },
    navButton: { padding: '10px 20px', fontSize: '1em', cursor: 'pointer', border: '1px solid #dadce0', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#3c4043' },
    submitButton: { padding: '10px 30px', fontSize: '1em', cursor: 'pointer', border: 'none', borderRadius: '4px', backgroundColor: '#4285F4', color: 'white' },
    disabledButton: { cursor: 'not-allowed', opacity: 0.5 },
    noQuestionsContainer: { textAlign: 'center', color: '#5f6368', padding: '40px 0' },
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);