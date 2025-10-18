let results = [];
let currentPairedWord = "";
let correctCount = 0;
let incorrectCount = 0;

const wordList = [
    'ပန်း', 'ဖား', 'ဟင်း', 'စား', 'လျှာ', 'ခေါင်း', 'နား', 'ည',
    'ဒန်း', 'နှင်း', 'ညှပ်', 'ဂျင်', 'က', 'ဓား', 'ယုန်', 'ပါး',
    'ဥ', 'ကား', 'ဘဲ', 'ဆိတ်', 'နွား', 'ဆင်', 'ကျောင်း', 'တို', 'ဆား'
];

const numberList = ['၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];

function getRandomPair() {
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    const randomNumber = numberList[Math.floor(Math.random() * numberList.length)];

    // Randomize order (0 = word first, 1 = number first)
    return Math.random() < 0.5
        ? `${randomWord} ${randomNumber}`
        : `${randomNumber} ${randomWord}`;
}

const navigateTo = async (name) => {
    document.querySelectorAll('.page.active').forEach(page => {
        page.classList.remove('active');
    });

    const targetPage = document.querySelector(`#${name}`);
    targetPage.classList.add('active');

    if (name === "test") {
        results = [];
        correctCount = 0;
        incorrectCount = 0;
        updateCounts();
        nextRound();
    }

    if (name === "results") {
        renderResultsPage();
    }

    if (name === "history") {
        await renderHistoryPage();
    }
}

const refreshPairedWord = () => {
    const pairedWordDisplay = document.querySelector('#test #pairedWord');
    currentPairedWord = getRandomPair();
    pairedWordDisplay.textContent = currentPairedWord;
}

const nextRound = () => {
    refreshPairedWord();
    renderPagination();
}

const response = async (isCorrect) => {
    results.push({
        name: currentPairedWord,
        response: isCorrect
    });

    isCorrect ? correctCount++ : incorrectCount++;
    updateCounts();
    renderPagination();
    if (results.length < 6) {
        nextRound();
    } else {
        console.log(results);

        // Save to IndexedDB
        const correct = results.filter(r => r.response).length;
        await saveResultToDB({
            date: new Date().toLocaleString(),
            correct,
            total: 6,
            details: results
        });

        await navigateTo('results');
    }
}

const updateCounts = () => {
    document.querySelector('#incorrectScore').textContent = incorrectCount;
    document.querySelector('#correctScore').textContent = correctCount;
}

const renderPagination = () => {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = ''; // clear previous

    for (let i = 0; i < 6; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');

        // show filled status if user answered this one
        if (results[i]) {
            dot.classList.add(results[i].response ? 'correct' : 'incorrect');
        } else if (i === results.length) {
            dot.classList.add('active'); // current question
        }

        pagination.appendChild(dot);
    }
};

const renderResultsPage = () => {
    const finalScore = document.getElementById('finalScore');
    const resultsList = document.querySelector('#results ul');

    // calculate score
    const correct = results.filter(r => r.response).length;
    finalScore.textContent = `${correct}/6`;

    // clear old list
    resultsList.innerHTML = '';

    // rebuild list items
    results.forEach(item => {
        const li = document.createElement('li');
        const name = document.createElement('p');
        const status = document.createElement('p');

        name.textContent = item.name;
        status.textContent = item.response ? '✅' : '❌';
        status.classList.add(item.response ? 'green' : 'red');

        li.appendChild(name);
        li.appendChild(status);
        resultsList.appendChild(li);
    });

    // optional: store in IndexedDB later
};

const renderHistoryPage = async () => {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<p>Loading...</p>';

    try {
        const history = await getAllResults();
        historyList.innerHTML = '';

        if (!history.length) {
            historyList.innerHTML = '<p class="noHistoryItem">No test history yet.</p>';
            return;
        }

        history.reverse().forEach(item => {
            const li = document.createElement('li');
            li.classList.add('history-item');

            // Save the id for swipe/delete
            li.dataset.id = item.id;

            const summary = document.createElement('div');
            summary.classList.add('history-summary');
            summary.innerHTML = `
        <p class="history-score">Score: ${item.correct}/${item.total}</p>
        <p class="history-date">${item.date}</p>
    `;

            const details = document.createElement('ul');
            details.classList.add('history-details', 'hidden');
            item.details.forEach(result => {
                const rli = document.createElement('li');
                rli.innerHTML = `<p>${result.name}</p><p class="${result.response ? 'green' : 'red'}">${result.response ? '✅' : '❌'}</p>`;
                details.appendChild(rli);
            });

            li.appendChild(summary);
            li.appendChild(details);
            historyList.appendChild(li);

            // Expand/collapse on click
            summary.addEventListener('click', () => {
                if (details.classList.contains('hidden')) {
                    details.classList.remove('hidden');
                    details.style.maxHeight = details.scrollHeight + 'px';
                } else {
                    details.style.maxHeight = '0';
                    details.addEventListener('transitionend', () => details.classList.add('hidden'), { once: true });
                }
            });

            // Swipe delete
            let startX = 0;
            let currentX = 0;
            let threshold = 100;

            li.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
            li.addEventListener('touchmove', e => {
                currentX = e.touches[0].clientX - startX;
                li.style.transform = `translateX(${currentX}px)`;
            });
            li.addEventListener('touchend', async e => {
                if (Math.abs(currentX) > threshold) {
                    const confirmDelete = await showConfirm("Delete this record?");
                    if (confirmDelete) {
                        await deleteResultFromDB(item.id);
                        li.remove();
                    } else {
                        li.style.transform = `translateX(0)`;
                    }
                } else {
                    li.style.transform = `translateX(0)`;
                }
                currentX = 0;
            });
        });
    } catch (err) {
        historyList.innerHTML = `<p>Error loading history: ${err.message}</p>`;
    }
};

const toggleDetails = (btn) => {
    const historyItem = btn.closest('.history-item');
    const details = historyItem.querySelector('.history-details');
    details.classList.toggle('hidden');
};

const showConfirm = (message) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msg = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        msg.textContent = message;
        modal.classList.add('show'); // animate in

        const cleanup = () => {
            modal.classList.remove('show'); // animate out
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };

        yesBtn.onclick = () => {
            cleanup();
            setTimeout(() => resolve(true), 300); // wait for animation
        };
        noBtn.onclick = () => {
            cleanup();
            setTimeout(() => resolve(false), 300);
        };
    });
};

const confirmResetTest = async () => {
    const confirm = await showConfirm("Are you sure you want to reset this test?");
    if (confirm) navigateTo('test');
};

const confirmBackToHome = async () => {
    const confirm = await showConfirm("Return to Home? Progress will be lost.");
    if (confirm) navigateTo('home');
};

// =================== IndexedDB SETUP ===================

const dbName = "whisperTestDB";
const storeName = "history";

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveResultToDB = async (data) => {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).add(data);
    await tx.complete;
};

const getAllResults = async () => {
    const db = await openDB();
    return new Promise(resolve => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });
};

const deleteResultFromDB = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
};

// Called by the button in history
const deleteResult = async (id) => {
    if (!(await showConfirm("Delete this record?"))) return;

    try {
        await deleteResultFromDB(id);
        await renderHistoryPage(); // refresh the page
    } catch (err) {
        alert("Failed to delete record: " + err.message);
    }
};


