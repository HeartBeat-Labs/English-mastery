// State management variables
let masterData = [];
let currentCategory = '';
let currentAlphaLetter = '';
let currentLevelQuestions = [];
let currentQuestionIndex = 0;
let currentLevelKey = '';
let currentScore = 0;
let userAnswers = {}; // Memory to store past answers to prevent score cheating
let userStates = { completedLevels: {}, scores: {} }; 

// Core Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadUserProgress();
    initApplication();
});

function loadUserProgress() {
    const data = localStorage.getItem('vocab_master_progress_v2');
    if (data) {
        userStates = JSON.parse(data);
    }
}

function saveUserProgress() {
    localStorage.setItem('vocab_master_progress_v2', JSON.stringify(userStates));
}

// Fetch generated JSON file
async function initApplication() {
    try {
        const response = await fetch('extracted_vocab_data.json');
        if (!response.ok) throw new Error('Could not load JSON data asset.');
        masterData = await response.json();
        console.log(`Loaded ${masterData.length} records successfully.`);
    } catch (error) {
        console.error('Data boot failed:', error);
        // FIX: Display error safely on the main menu, not hidden inside the quiz view
        const grid = document.querySelector('.menu-grid');
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: #ff3366; padding: 20px; font-weight: bold; background: rgba(255, 51, 102, 0.1); border-radius: 10px;">
            Error loading extracted_vocab_data.json. Make sure the file exists in this directory.
        </div>`;
    }
}

// Helper Function: Extract allowed letters from file names
function extractLettersFromFilename(filename) {
    if (!filename) return [];
    let match = filename.match(/PYQ\s+(.*?)_w/i);
    if (!match) return [];
    
    let str = match[1].toUpperCase();
    let letters = [];
    
    let rangeMatch = str.match(/([A-Z])\s*(?:TO|\-)\s*([A-Z])/);
    if (rangeMatch) {
        let start = rangeMatch[1].charCodeAt(0);
        let end = rangeMatch[2].charCodeAt(0);
        for (let i = start; i <= end; i++) {
            letters.push(String.fromCharCode(i));
        }
        return letters;
    }
    
    let indiv = str.match(/[A-Z]/g);
    if (indiv) return indiv;
    return [];
}

// Navigation Routing Engine
function navigateTo(target, parameter = null, levelKey = null) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('btn-return').style.display = 'block';

    if (['word-meanings', 'phrasal-verbs', 'spellings', 'idioms-phrases', 'pyq-idioms'].includes(target)) {
        currentCategory = target;
        buildLevelsView(filterDataByCategory(target), target.replace('-', ' ').toUpperCase());
    } 
    else if (target === 'pyq-word-meanings') {
        currentCategory = target;
        document.getElementById('main-title').innerText = "PYQ Alphabetical";
        buildAlphabeticalView();
    }
    else if (target === 'pyq-alpha-letter') {
        currentAlphaLetter = parameter;
        
        const filtered = filterDataByCategory('pyq-word-meanings').filter(item => {
            let allowedLetters = extractLettersFromFilename(item.source_file);
            
            if (allowedLetters.length > 0 && !allowedLetters.includes(currentAlphaLetter)) return false;
            if (allowedLetters.length === 1 && allowedLetters[0] === currentAlphaLetter) return true;
            
            // FIX: Massively expanded ignore list to prevent false categorizations
            const ignoreWords = ['CHOOSE', 'SELECT', 'FIND', 'WHAT', 'IS', 'GIVE', 'IDENTIFY', 'THE', 'MOST', 'APPROPRIATE', 'CORRECT', 'CLOSEST', 'SYNONYM', 'ANTONYM', 'MEANING', 'WORD', 'GIVEN', 'OF', 'FOR', 'TO', 'A', 'AN', 'IN', 'WHICH', 'FOLLOWING', 'OPPOSITE', 'SIMILAR', 'BEST', 'EXPRESSES', 'SUBSTITUTE', 'SUBSTITUTES', 'MEANINGFUL', 'PHRASE', 'REPLACE', 'UNDERLINED', 'SEGMENT', 'SENTENCE', 'OUT', 'ALTERNATIVES', 'ONE', 'WORDS'];
            
            let text = item.question.toUpperCase();
            let words = text.split(/[^A-Z]+/);
            let rootLetter = '';
            
            for (let w of words) {
                if (w.length > 0 && !ignoreWords.includes(w)) {
                    rootLetter = w[0];
                    break;
                }
            }
            return rootLetter === currentAlphaLetter;
        });
        
        buildLevelsView(filtered, `PYQ Words: Letter ${currentAlphaLetter}`);
    }
    else if (target === 'mixed-sets') {
        currentCategory = 'mixed-sets';
        buildMixedSetsView();
    }
    else if (target === 'quiz') {
        startQuiz(parameter, levelKey);
    }
}

// Data Parser Filter
function filterDataByCategory(category) {
    return masterData.filter(item => {
        const sourceLower = (item.source_file || "").toLowerCase();
        
        if (category === 'word-meanings') return !item.is_pyq && (sourceLower.includes('meaning') || sourceLower.includes('substitution'));
        if (category === 'phrasal-verbs') return !item.is_pyq && sourceLower.includes('phrasal');
        if (category === 'spellings') return !item.is_pyq && sourceLower.includes('spelling');
        if (category === 'idioms-phrases') return !item.is_pyq && sourceLower.includes('idioms');
        if (category === 'pyq-idioms') return item.is_pyq && sourceLower.includes('idiom');
        if (category === 'pyq-word-meanings') return item.is_pyq && (sourceLower.includes('word') || sourceLower.includes('wrod')); 
        
        return false;
    });
}

function buildAlphabeticalView() {
    const grid = document.getElementById('alpha-grid');
    grid.innerHTML = '';
    document.getElementById('view-alpha').classList.add('active');
    
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    alphabet.forEach(letter => {
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.innerText = letter;
        card.onclick = () => navigateTo('pyq-alpha-letter', letter);
        grid.appendChild(card);
    });
}

function buildLevelsView(dataSet, viewTitle) {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    document.getElementById('view-levels').classList.add('active');
    
    document.getElementById('main-title').innerText = viewTitle;

    const itemsPerLevel = 25;
    const totalLevels = Math.ceil(dataSet.length / itemsPerLevel);

    if(totalLevels === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); font-size: 1.1rem; padding: 20px;">No questions found for this category.</div>`;
        return;
    }

    for (let i = 0; i < totalLevels; i++) {
        const levelNum = i + 1;
        const startIndex = i * itemsPerLevel;
        const slicedQuestions = dataSet.slice(startIndex, startIndex + itemsPerLevel);
        
        const levelKey = `${currentCategory}_${currentAlphaLetter}_lvl_${levelNum}`;
        const isCompleted = userStates.completedLevels[levelKey] ? `✓ Score: ${userStates.scores[levelKey] || 0}/25` : "Unattempted";

        const card = document.createElement('div');
        card.className = 'menu-card level-card';
        card.innerHTML = `Level ${levelNum} <div class="progress-badge">${isCompleted}</div>`;
        card.onclick = () => navigateTo('quiz', slicedQuestions, levelKey);
        grid.appendChild(card);
    }
}

// NEW: Dynamically Generate Balanced Mixed Sets
function buildMixedSetsView() {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    document.getElementById('view-levels').classList.add('active');
    document.getElementById('main-title').innerText = "Dynamic Mixed Sets";

    // Gather and shuffle buckets
    const buckets = [
        filterDataByCategory('word-meanings').sort(() => Math.random() - 0.5),
        filterDataByCategory('idioms-phrases').sort(() => Math.random() - 0.5),
        filterDataByCategory('pyq-word-meanings').sort(() => Math.random() - 0.5),
        filterDataByCategory('pyq-idioms').sort(() => Math.random() - 0.5),
        filterDataByCategory('phrasal-verbs').sort(() => Math.random() - 0.5)
    ].filter(b => b.length > 0);

    if (buckets.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">No data available to mix.</div>`;
        return;
    }

    // Generate up to 50 sets to keep UI clean
    const totalMixedSets = 50; 
    const questionsPerSet = 25;

    for (let i = 0; i < totalMixedSets; i++) {
        let mixedChunk = [];
        let questionsPerBucket = Math.floor(questionsPerSet / buckets.length);
        let remainder = questionsPerSet % buckets.length;

        buckets.forEach(bucket => {
            // Pull proportional amount, cycle back to start of bucket if we run out
            for(let j=0; j < questionsPerBucket; j++) {
                mixedChunk.push(bucket[(i * questionsPerBucket + j) % bucket.length]);
            }
        });

        // Fill remainder from a random bucket
        for(let r=0; r < remainder; r++) {
            let randomBucket = buckets[Math.floor(Math.random() * buckets.length)];
            mixedChunk.push(randomBucket[Math.floor(Math.random() * randomBucket.length)]);
        }

        // Shuffle the final chunk so it's fully randomized
        mixedChunk.sort(() => Math.random() - 0.5);

        const levelKey = `mixed_set_${i + 1}`;
        const isCompleted = userStates.completedLevels[levelKey] ? `✓ Score: ${userStates.scores[levelKey] || 0}/25` : "Unattempted";

        const card = document.createElement('div');
        card.className = 'menu-card level-card';
        card.innerHTML = `Mix Set ${i + 1} <div class="progress-badge">${isCompleted}</div>`;
        card.onclick = () => navigateTo('quiz', mixedChunk, levelKey);
        grid.appendChild(card);
    }
}

// Return logic with Header Fix
function handleReturn() {
    const currentActiveView = document.querySelector('.view.active').id;
    
    if (currentActiveView === 'view-quiz' || currentActiveView === 'view-results') {
        if (currentCategory === 'pyq-word-meanings') {
            navigateTo('pyq-alpha-letter', currentAlphaLetter);
        } else if (currentCategory === 'mixed-sets') {
            navigateTo('mixed-sets');
        } else {
            navigateTo(currentCategory);
        }
    } else if (currentActiveView === 'view-levels' && currentCategory === 'pyq-word-meanings') {
        navigateTo('pyq-word-meanings');
    } else {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-main').classList.add('active');
        document.getElementById('btn-return').style.display = 'none';
        
        // FIX: Reset header title completely when returning to main menu
        document.getElementById('main-title').innerText = "Vocab & PYQ Engine";
    }
}

// Interactive Quiz Engine Core
function startQuiz(questionsArray, levelKey) {
    currentLevelQuestions = questionsArray;
    currentLevelKey = levelKey;
    currentQuestionIndex = 0;
    currentScore = 0;
    userAnswers = {}; // Clear memory for new quiz
    
    document.getElementById('view-levels').classList.remove('active');
    document.getElementById('view-alpha').classList.remove('active');
    document.getElementById('view-results').classList.remove('active');
    document.getElementById('view-quiz').classList.add('active');
    
    // Update Badge Title
    let badgeText = currentLevelKey.includes('mixed') ? `Mixed Set` : `Level`;
    document.getElementById('quiz-title-badge').innerText = badgeText;

    renderQuestion();
}

function renderQuestion() {
    const item = currentLevelQuestions[currentQuestionIndex];
    document.getElementById('quiz-progress-text').innerText = `Question ${currentQuestionIndex + 1} of ${currentLevelQuestions.length}`;
    document.getElementById('question-text').innerText = item.question;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    const keys = ['a', 'b', 'c', 'd'];
    keys.forEach(key => {
        if (item.options[key]) {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${item.options[key]}`;
            btn.dataset.key = key; 
            btn.onclick = () => evaluateAnswer(btn, key);
            optionsContainer.appendChild(btn);
        }
    });

    document.getElementById('btn-prev').disabled = (currentQuestionIndex === 0);
    
    // Check Memory State to prevent re-answering
    if (userAnswers[currentQuestionIndex]) {
        restoreAnswerState(item, userAnswers[currentQuestionIndex]);
    } else {
        // Change Next to Skip if unanswered
        document.getElementById('btn-next').innerText = "Skip ➔";
    }
}

function restoreAnswerState(item, answerData) {
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.key === item.answer.trim().toLowerCase()) {
            btn.classList.add('correct');
        } else if (btn.dataset.key === answerData.selected && !answerData.isCorrect) {
            btn.classList.add('wrong');
        }
    });
    
    updateNextButtonState();
}

function evaluateAnswer(selectedBtn, chosenKey) {
    const item = currentLevelQuestions[currentQuestionIndex];
    const correctKey = item.answer.trim().toLowerCase();
    const isCorrect = (chosenKey === correctKey);
    
    // Memory Save
    userAnswers[currentQuestionIndex] = {
        selected: chosenKey,
        isCorrect: isCorrect
    };

    if (isCorrect) currentScore++;

    restoreAnswerState(item, userAnswers[currentQuestionIndex]);

    // Small auto-advance if it's not the last question
    if (currentQuestionIndex < currentLevelQuestions.length - 1) {
        setTimeout(() => {
            changeQuestion(1);
        }, 800);
    }
}

function updateNextButtonState() {
    const nextBtn = document.getElementById('btn-next');
    if (currentQuestionIndex === currentLevelQuestions.length - 1) {
        nextBtn.innerText = "Finish Set ★";
    } else {
        nextBtn.innerText = "Next ➔";
    }
}

function changeQuestion(direction) {
    if (direction === 1 && currentQuestionIndex === currentLevelQuestions.length - 1) {
        finishSet();
    } else {
        currentQuestionIndex += direction;
        renderQuestion();
    }
}

// Results View Logic
function finishSet() {
    userStates.completedLevels[currentLevelKey] = true;
    
    // Save highest score achieved
    if (!userStates.scores[currentLevelKey] || currentScore > userStates.scores[currentLevelKey]) {
        userStates.scores[currentLevelKey] = currentScore;
    }
    saveUserProgress();

    document.getElementById('view-quiz').classList.remove('active');
    document.getElementById('view-results').classList.add('active');
    document.getElementById('score-display').innerText = `${currentScore} / ${currentLevelQuestions.length}`;
}

// NEW: Keyboard Shortcuts (1-4, Arrows, Space, Backspace)
document.addEventListener('keydown', (e) => {
    const quizView = document.getElementById('view-quiz');
    if (!quizView.classList.contains('active')) return;

    const key = e.key.toLowerCase();
    const options = document.querySelectorAll('.option-btn');

    // 1-4 mappings for answers
    if (!options[0]?.disabled) {
        if (key === '1' || key === 'a') options[0]?.click();
        if (key === '2' || key === 'b') options[1]?.click();
        if (key === '3' || key === 'c') options[2]?.click();
        if (key === '4' || key === 'd') options[3]?.click();
    }

    // Navigation
    if (key === 'arrowright' || e.code === 'Space') {
        e.preventDefault();
        changeQuestion(1);
    }
    
    if (key === 'arrowleft' || key === 'backspace') {
        e.preventDefault();
        if (currentQuestionIndex > 0) changeQuestion(-1);
    }
});