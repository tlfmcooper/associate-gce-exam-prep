const fs = require('fs');
const path = require('path');

// Read the questions.ts file
const questionsPath = path.join(__dirname, 'questions.ts');
let content = fs.readFileSync(questionsPath, 'utf-8');

// Extract the questions array (everything between 'export const questions: Question[] = [' and the final '];')
const startMarker = 'export const questions: Question[] = [';
const startIndex = content.indexOf(startMarker);
const endIndex = content.lastIndexOf('];');

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find questions array in questions.ts');
    process.exit(1);
}

const beforeArray = content.substring(0, startIndex + startMarker.length);
const afterArray = content.substring(endIndex);
const arrayContent = content.substring(startIndex + startMarker.length, endIndex);

// Parse individual question objects
const questions = [];
let depth = 0;
let currentQuestion = '';
let inString = false;
let stringChar = '';

for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];
    const prevChar = i > 0 ? arrayContent[i - 1] : '';
    
    // Track string state
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
            inString = true;
            stringChar = char;
        } else if (char === stringChar) {
            inString = false;
            stringChar = '';
        }
    }
    
    // Track object depth only when not in string
    if (!inString) {
        if (char === '{') depth++;
        if (char === '}') depth--;
    }
    
    currentQuestion += char;
    
    // When we close an object at depth 0, we have a complete question
    if (!inString && char === '}' && depth === 0) {
        questions.push(currentQuestion.trim());
        currentQuestion = '';
        // Skip comma and whitespace after the question
        while (i + 1 < arrayContent.length && (arrayContent[i + 1] === ',' || arrayContent[i + 1].match(/\s/))) {
            i++;
        }
    }
}

console.log(`Found ${questions.length} questions`);

// Shuffle function
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Process each question to shuffle its options
const shuffledQuestions = questions.map((questionStr, index) => {
    // Extract the options array and correct value
    const optionsMatch = questionStr.match(/options:\s*\[([\s\S]*?)\],/);
    const correctMatch = questionStr.match(/correct:\s*(\d+)/);
    
    if (!optionsMatch || !correctMatch) {
        console.warn(`Question ${index + 1}: Could not parse options or correct value, skipping shuffle`);
        return questionStr;
    }
    
    const optionsStr = optionsMatch[1];
    const correctIndex = parseInt(correctMatch[1]);
    
    // Parse individual options (they are strings)
    const options = [];
    let currentOption = '';
    let inStr = false;
    let strChar = '';
    let escapeNext = false;
    
    for (let i = 0; i < optionsStr.length; i++) {
        const char = optionsStr[i];
        
        if (escapeNext) {
            currentOption += char;
            escapeNext = false;
            continue;
        }
        
        if (char === '\\') {
            currentOption += char;
            escapeNext = true;
            continue;
        }
        
        if ((char === '"' || char === "'" || char === '`') && !inStr) {
            inStr = true;
            strChar = char;
            currentOption = char;
            continue;
        }
        
        if (char === strChar && inStr && !escapeNext) {
            currentOption += char;
            options.push(currentOption);
            currentOption = '';
            inStr = false;
            strChar = '';
            // Skip comma and whitespace
            while (i + 1 < optionsStr.length && (optionsStr[i + 1] === ',' || optionsStr[i + 1].match(/\s/))) {
                i++;
            }
            continue;
        }
        
        if (inStr) {
            currentOption += char;
        }
    }
    
    if (options.length === 0) {
        console.warn(`Question ${index + 1}: No options found, skipping shuffle`);
        return questionStr;
    }
    
    // Create shuffled indices
    const indices = Array.from({ length: options.length }, (_, i) => i);
    const shuffledIndices = shuffle(indices);
    
    // Find new position of correct answer
    const newCorrectIndex = shuffledIndices.indexOf(correctIndex);
    
    // Create shuffled options array
    const shuffledOptions = shuffledIndices.map(i => options[i]);
    
    // Rebuild the question string with shuffled options
    let newQuestionStr = questionStr.replace(
        /options:\s*\[[\s\S]*?\],/,
        `options: [${shuffledOptions.join(', ')}],`
    );
    
    newQuestionStr = newQuestionStr.replace(
        /correct:\s*\d+/,
        `correct: ${newCorrectIndex}`
    );
    
    console.log(`Question ${index + 1}: Shuffled (correct answer moved from position ${correctIndex} to ${newCorrectIndex})`);
    
    return newQuestionStr;
});

// Reconstruct the file
const newContent = beforeArray + '\n' + shuffledQuestions.join(',\n') + '\n' + afterArray;

// Write back to file
fs.writeFileSync(questionsPath, newContent, 'utf-8');

console.log('\n✅ Successfully shuffled all question options in questions.ts');
console.log('The correct answer indices have been updated to reflect the new positions.');
