
const OR_API_KEY_STORAGE = 'travel_assistant_or_key';
const SESSION_HISTORY_STORAGE = 'travel_assistant_sessions';

let currentSessionId = null;
let sessions = {};

const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const inputMessage = document.getElementById('inputMessage');
const btnSend = document.getElementById('btnSend');
const btnNewSession = document.getElementById('btnNewSession');
const btnClearHistory = document.getElementById('btnClearHistory');
const btnResetKey = document.getElementById('btnResetKey');
const footerInfo = document.getElementById('footerInfo');
const sessionListEl = document.querySelector('.session-list');
const heroSection = document.querySelector('.hero');

function initializeApp() {
    const savedKey = localStorage.getItem(OR_API_KEY_STORAGE);
    if (savedKey) {
        setApiKey(savedKey);
    } else {
        promptApiKey();
    }
    const storedSessions = localStorage.getItem(SESSION_HISTORY_STORAGE);
    sessions = storedSessions ? JSON.parse(storedSessions) : {};
    if (Object.keys(sessions).length === 0) {
        startNewSession();
    } else {
        const lastSessionId = Object.keys(sessions).sort((a, b) => sessionLastTime(sessions[b]) - sessionLastTime(sessions[a]))[0];
        loadSession(lastSessionId);
    }
    renderSessionList();
}

function sessionLastTime(messages) {
    if (!messages || messages.length === 0) return 0;
    return new Date(messages[messages.length - 1].time).getTime() || 0;
}

function promptApiKey() {
    let key = prompt('Please enter your OpenRouter API key:');
    if (key && key.trim()) {
        setApiKey(key.trim());
    } else {
        footerInfo.textContent = 'No API key provided. Chatbot disabled.';
        btnSend.disabled = true;
        inputMessage.disabled = true;
    }
}

function setApiKey(key) {
    orApiKey = key;
    localStorage.setItem(OR_API_KEY_STORAGE, orApiKey);
    footerInfo.textContent = 'OpenRouter API Key set. Start chatting!';
    btnSend.disabled = false;
    inputMessage.disabled = false;
    inputMessage.focus();
}

function resetApiKey() {
    orApiKey = '';
    localStorage.removeItem(OR_API_KEY_STORAGE);
    footerInfo.textContent = 'API Key reset. Please enter a new API Key.';
    btnSend.disabled = true;
    inputMessage.disabled = true;
    promptApiKey();
}

function startNewSession() {
    currentSessionId = generateUniqueId();
    sessions[currentSessionId] = [];
    saveSessions();
    renderSessionList();
    loadSession(currentSessionId);
    clearMessages();
    heroSection.style.display = 'block';
}

function loadSession(id) {
    if (!id || !sessions[id]) return;
    currentSessionId = id;
    clearMessages();
    const msgs = sessions[id];
    if (msgs.length) {
        heroSection.style.display = 'none';
        msgs.forEach(m => addMessageToUI(m));
    } else {
        heroSection.style.display = 'block';
    }
    highlightActiveSession();
    updateFooterInfo();
}

function saveSessions() {
    localStorage.setItem(SESSION_HISTORY_STORAGE, JSON.stringify(sessions));
}

function renderSessionList() {
    sessionListEl.innerHTML = '';
    const sessionEntries = Object.entries(sessions);
    sessionEntries.sort((a, b) => {
        const aTime = sessionLastTime(a[1]);
        const bTime = sessionLastTime(b[1]);
        return bTime - aTime;
    });
    if (sessionEntries.length === 0) {
        const noSession = document.createElement('div');
        noSession.textContent = 'No conversations yet';
        noSession.style.color = 'var(--color-text-secondary)';
        noSession.style.fontSize = '0.95rem';
        noSession.style.padding = '0.75rem 1rem';
        sessionListEl.appendChild(noSession);
        return;
    }
    for (const [sessionId, messages] of sessionEntries) {
        const sessionItem = document.createElement('button');
        sessionItem.type = 'button';
        sessionItem.className = 'session-item';
        sessionItem.title = `Session with ${messages.length} messages`;
        sessionItem.setAttribute('role', 'listitem');
        let firstMsg = messages.length > 0 ? messages[0].content : 'New conversation';
        sessionItem.textContent = truncateText(firstMsg, 30);
        if (sessionId === currentSessionId) {
            sessionItem.classList.add('active');
            sessionItem.setAttribute('aria-current', 'true');
        }
        sessionItem.onclick = () => loadSession(sessionId);
        if (messages.length > 0) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.setAttribute('aria-label', 'Delete this conversation');
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete this conversation?')) {
                    delete sessions[sessionId];
                    if (currentSessionId === sessionId) {
                        startNewSession();
                    } else {
                        saveSessions();
                        renderSessionList();
                    }
                }
            };
            sessionItem.appendChild(delBtn);
        }
        sessionListEl.appendChild(sessionItem);
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
}

function highlightActiveSession() {
    const buttons = sessionListEl.querySelectorAll('.session-item');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
    });
    const activeBtn = Array.from(buttons).find(b => b.textContent.startsWith(sessions[currentSessionId]?.[0]?.content?.slice(0, 30) || ''));
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-current', 'true');
    }
}

function clearMessages() {
    messagesEl.innerHTML = '';
}

function appendMessage(role, content) {
    if (!currentSessionId) return;
    const time = new Date().toISOString();
    const message = { role, content, time };
    if (!sessions[currentSessionId]) sessions[currentSessionId] = [];
    sessions[currentSessionId].push(message);
    saveSessions();
    addMessageToUI(message);
}

function addMessageToUI(message) {
    if (heroSection.style.display !== 'none') {
        heroSection.style.display = 'none';
    }
    const msgEl = document.createElement('div');
    msgEl.classList.add('message', message.role === 'user' ? 'user' : 'assistant');
    msgEl.setAttribute('role', 'listitem');
    msgEl.innerHTML = sanitizeHTML(message.content).replace(/\n/g, '<br>');
    const timeEl = document.createElement('div');
    timeEl.className = 'time';
    timeEl.setAttribute('aria-label', 'Time sent');
    const dt = new Date(message.time);
    timeEl.textContent = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    msgEl.appendChild(timeEl);
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function showLoading() {
    const loadingEl = document.createElement('div');
    loadingEl.classList.add('message', 'assistant', 'loading-dots');
    loadingEl.setAttribute('aria-live', 'polite');
    loadingEl.setAttribute('id', 'loading');
    loadingEl.innerHTML = `
        <span></span><span></span><span></span>
        <div class="time" aria-label="Loading">...</div>
      `;
    messagesEl.appendChild(loadingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        messagesEl.removeChild(loadingEl);
    }
}

function generateUniqueId() {
    return 'session_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function callOpenRouterAPI(userInput) {
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const messagesForAPI = [
        {
            role: 'system',
            content: "You are a helpful, friendly Travel Assistant. Answer travel-related questions only. If asked something unrelated, respond: 'I'm just a travel assistant bot.'"
        },
        ...sessions[currentSessionId].map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userInput }
    ];

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${orApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "deepseek/deepseek-r1-0528:free",
            messages: messagesForAPI,
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "⚠️ No response from the assistant.";
}

chatForm.addEventListener('submit', async e => {
    e.preventDefault();
    const userInput = inputMessage.value.trim();
    if (!userInput || !orApiKey) return;

    inputMessage.value = '';
    btnSend.disabled = true;

    appendMessage('user', userInput);
    showLoading();

    try {
        const botResponse = await callOpenRouterAPI(userInput);

        removeLoading();
        appendMessage('assistant', botResponse);
        renderSessionList();
    } catch (error) {
        removeLoading();
        console.error('API Error:', error);

        let errorMessage = '⚠️ Sorry, I encountered an error. ';
        if (error.message.includes('404')) {
            errorMessage += 'The model might not be available.';
        } else if (error.message.includes('503')) {
            errorMessage += 'The service is temporarily unavailable.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage += 'Please check your API key.';
        } else {
            errorMessage += error.message;
        }

        appendMessage('assistant', errorMessage);
    } finally {
        btnSend.disabled = false;
        inputMessage.focus();
    }
});

inputMessage.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
    btnSend.disabled = !this.value.trim();
});

inputMessage.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

btnNewSession.addEventListener('click', () => {
    if (confirm('Start a new conversation? Current conversation will be saved.')) {
        startNewSession();
    }
});

btnClearHistory.addEventListener('click', () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
        sessions = {};
        currentSessionId = null;
        saveSessions();
        renderSessionList();
        startNewSession();
    }
});

btnResetKey.addEventListener('click', () => {
    if (confirm('Reset API Key? You will need to enter a new API Key.')) {
        resetApiKey();
    }
});

function updateFooterInfo() {
    if (!currentSessionId || !sessions[currentSessionId]) {
        footerInfo.textContent = 'Start chatting by entering a message.';
    } else {
        footerInfo.textContent = `Chat session with ${sessions[currentSessionId].length} messages. Powered by OpenRouter AI.`;
    }
}

let orApiKey = '';
window.addEventListener('load', initializeApp);