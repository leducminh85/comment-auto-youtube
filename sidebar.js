// --- START OF FILE sidebar.js ---

document.addEventListener('DOMContentLoaded', () => {
  // --- Element Selectors ---
  const apiKeyToggle = document.getElementById('apiKeyToggle');
  const apiKeyContent = document.getElementById('apiKeyContent');
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const modeBtns = document.querySelectorAll('.mode-toggle .toggle-btn[data-mode]');
  const toggleBtn = document.getElementById('toggleBtn');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const commentText = document.getElementById('commentText');
  const commentTextContent = document.getElementById('commentTextContent');
  const commentTextPlaceholder = document.getElementById('commentTextPlaceholder');
  const replyText = document.getElementById('replyText');
  const replySkeleton = document.getElementById('replySkeleton');
  const regenerateBtn = document.getElementById('regenerateBtn');
  const applyBtn = document.getElementById('applyBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const logBox = document.getElementById('logBox');
  const clearLog = document.getElementById('clearLog');
  const customPrompt = document.getElementById('customPrompt');
  // ... (rest of selectors are unchanged)
  const savePromptBtn = document.getElementById('savePrompt');
  const resetPromptBtn = document.getElementById('resetPrompt');
  const promptStatus = document.getElementById('promptStatus');
  const contextModeBtns = document.querySelectorAll('.context-mode-btn');
  const promptModeContainer = document.getElementById('promptModeContainer');
  const chatbotModeContainer = document.getElementById('chatbotModeContainer');
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotContent = document.getElementById('chatbotContent');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
  const chatOptionsBtn = document.getElementById('chatOptionsBtn');
  const chatOptionsMenu = document.getElementById('chatOptionsMenu');
  const autoSaveToggle = document.getElementById('autoSaveToggle');
  const clearChatBtn = document.getElementById('clearChatBtn');
  
  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  // --- State Variables ---
  let isRunning = false;
  let currentMode = 'continuous';
  let currentContextMode = 'prompt';
  let autoSaveReplies = true;
  let currentChannelId = null;
  let chatHistory = [];

  // === NEW: PREVIEW STATE MANAGER ===
  /**
   * Manages the UI of the preview panel based on the current state.
   * @param {'hidden' | 'waiting' | 'loading' | 'ready'} state 
   * @param {object} [data={}] - Optional data like comment or reply text.
   */
  function setPreviewState(state, data = {}) {
    // preview.style.display = (state === 'hidden') ? 'none' : 'block';
    preview.style.display =  'block';

    if (state === 'hidden') return;

    // Default: all buttons disabled
    regenerateBtn.disabled = true;
    applyBtn.disabled = true;
    cancelBtn.disabled = true;

    // Default: hide actual content, show placeholders/loaders
    commentTextContent.style.display = 'none';
    commentTextPlaceholder.style.display = 'block';
    replyText.style.display = 'none';
    replySkeleton.style.display = 'block';

    switch(state) {
      case 'waiting':
        commentTextPlaceholder.textContent = 'Đang tìm bình luận tiếp theo...';
        break;
      
      case 'loading':
        commentTextPlaceholder.style.display = 'none';
        commentTextContent.style.display = 'block';
        commentTextContent.textContent = data.comment || '';
        commentTextPlaceholder.textContent = '';
        break;

      case 'ready':
        commentTextPlaceholder.style.display = 'none';
        commentTextContent.style.display = 'block';
        commentTextContent.textContent = data.comment || '';
        replySkeleton.style.display = 'none';
        replyText.style.display = 'block';
        replyText.value = data.reply || '';
        replyText.focus();
        // Enable buttons only when ready
        regenerateBtn.disabled = false;
        applyBtn.disabled = false;
        cancelBtn.disabled = false;
        break;
    }
  }


  // === INITIALIZATION & HELPERS (largely unchanged) ===
  async function getCurrentChannelId() { /* ... no changes ... */ }
  function disableChatbotUI(message) { /* ... no changes ... */ }
  async function initializeSidebar() { /* ... no changes ... */ }
  async function getCurrentChannelId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const match = url.match(/studio\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      }
    } catch (error) { console.error("Error getting channel ID:", error); return null; }
    return null;
  }
  function disableChatbotUI(message) {
    chatbotToggle.style.opacity = '0.5';
    chatbotToggle.style.pointerEvents = 'none';
    const originalTitle = chatbotToggle.querySelector('span').textContent;
    chatbotToggle.querySelector('span').textContent = message;
    setTimeout(() => { chatbotToggle.querySelector('span').textContent = originalTitle; }, 4000);
  }
  async function initializeSidebar() {
    currentChannelId = await getCurrentChannelId();
    const result = await chrome.storage.local.get(['apiKey', 'customPrompt', 'contextMode', 'autoSaveReplies', 'allChatHistories']);
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Status: Custom' : 'Status: Default';
    currentContextMode = result.contextMode || 'prompt';
    contextModeBtns.forEach(btn => { btn.classList.toggle('active', btn.dataset.contextMode === currentContextMode); });
    updateContextUI(currentContextMode);
    autoSaveReplies = result.autoSaveReplies !== false;
    autoSaveToggle.checked = autoSaveReplies;
    if (currentChannelId) {
      const allHistories = result.allChatHistories || {};
      chatHistory = allHistories[currentChannelId] || [];
      appendLog(`Loaded context for channel: ${currentChannelId.substring(0,10)}...`);
    } else {
      disableChatbotUI("Không tìm thấy kênh YouTube");
      appendLog("Not on a valid YouTube Studio channel page.");
    }
    renderChat();
  }
  initializeSidebar();

  // === Event Listeners and other functions ===
  apiKeyToggle.addEventListener('click', () => { /* ... no changes ... */ });
  modeBtns.forEach(btn => { /* ... no changes ... */ });
  function updateContextUI(mode) { /* ... no changes ... */ }
  contextModeBtns.forEach(btn => { /* ... no changes ... */ });
  saveKeyBtn.addEventListener('click', () => { /* ... no changes ... */ });
  savePromptBtn.addEventListener('click', () => { /* ... no changes ... */ });
  resetPromptBtn.addEventListener('click', () => { /* ... no changes ... */ });
    apiKeyToggle.addEventListener('click', () => {
    const isOpen = apiKeyContent.style.display === 'block';
    apiKeyContent.style.display = isOpen ? 'none' : 'block';
    apiKeyToggle.classList.toggle('open', !isOpen);
  });
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      appendLog(`Mode switched to: ${currentMode}`);
    });
  });
  function updateContextUI(mode) {
    promptModeContainer.style.display = (mode === 'prompt') ? 'block' : 'none';
    chatbotModeContainer.style.display = (mode === 'chatbot') ? 'block' : 'none';
  }
  contextModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      contextModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentContextMode = btn.dataset.contextMode;
      chrome.storage.local.set({ contextMode: currentContextMode });
      appendLog(`Context source switched to: ${currentContextMode}`);
      updateContextUI(currentContextMode);
    });
  });
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'API Key Saved!';
        setTimeout(() => status.textContent = 'Ready', 2000);
        apiKeyContent.style.display = 'none';
        apiKeyToggle.classList.remove('open');
      });
    }
  });
  savePromptBtn.addEventListener('click', () => {
    const p = customPrompt.value.trim();
    if (p) chrome.storage.local.set({ customPrompt: p }, () => promptStatus.textContent = 'Saved!');
  });
  resetPromptBtn.addEventListener('click', () => {
    customPrompt.value = DEFAULT_PROMPT;
    chrome.storage.local.remove('customPrompt', () => promptStatus.textContent = 'Restored to default!');
  });

  // === UPDATED: START/STOP LOGIC ===
  toggleBtn.addEventListener('click', () => { isRunning ? stopProcessing() : startProcessing(); });

  function startProcessing() {
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!result.apiKey) {
        status.textContent = 'API Key is missing!';
        status.style.color = 'var(--danger)';
        setTimeout(() => {
            status.textContent = 'Ready';
            status.style.color = 'var(--success)';
        }, 2000);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) { status.textContent = 'No active tab found'; return; }
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'start', mode: currentMode, apiKey: result.apiKey });
        
        isRunning = true;
        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.add('btn-danger');
        toggleBtn.classList.remove('btn-primary');
        status.textContent = `Running: ${currentMode}`;
        status.style.color = 'var(--success)';
        appendLog(`Started in ${currentMode} mode`);
        setPreviewState('waiting'); // <-- KEY CHANGE
      });
    });
  }

  function stopProcessing() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
    });
    
    isRunning = false;
    toggleBtn.textContent = 'Start';
    toggleBtn.classList.remove('btn-danger');
    toggleBtn.classList.add('btn-primary');
    status.textContent = 'Stopped';
    status.style.color = 'var(--danger)';
    appendLog('Stopped');
    setPreviewState('hidden'); // <-- KEY CHANGE
  }

  // === UPDATED: PREVIEW BUTTONS ===
  regenerateBtn.addEventListener('click', () => {
    status.textContent = 'Regenerating...';
    setPreviewState('loading', { comment: commentTextContent.textContent }); // Re-enter loading state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'regenerate' });
    });
  });

  applyBtn.addEventListener('click', () => {
    setPreviewState('waiting'); // Immediately show waiting state for next comment
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'applyReply', reply: replyText.value });
    });
  });

  cancelBtn.addEventListener('click', () => {
    setPreviewState('waiting'); // Immediately show waiting state for next comment
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'skipAndNext' });
    });
    appendLog('Skipped → next comment');
  });

  // LOG
  function appendLog(msg) { /* ... no changes ... */ }
  clearLog.addEventListener('click', () => { /* ... no changes ... */ });
  function appendLog(msg) {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }
  clearLog.addEventListener('click', () => {
    logBox.textContent = '';
    appendLog('Log cleared');
  });
  
  // === UPDATED: MESSAGE LISTENER ===
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'showPreviewLoading') {
        setPreviewState('loading', { comment: msg.comment });
        appendLog('Waiting for AI response...');
    } else if (msg.action === 'showPreview') {
        setPreviewState('ready', { comment: msg.comment, reply: msg.reply });
        appendLog('Preview ready');
    } else if (msg.action === 'setLoading') {
        status.textContent = msg.loading ? 'Loading...' : `Running: ${currentMode}`;
    } else if (msg.action === 'log') {
        appendLog(msg.text);
    } else if (msg.action === 'addToChatHistory') {
      if (currentChannelId && currentContextMode === 'chatbot' && autoSaveReplies) {
        const { comment, reply } = msg;
        chatHistory.push({ role: 'user', parts: [{ text: comment }] });
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        saveChatHistory();
        renderChat();
        appendLog('Manual reply saved to chat context.');
      } else if (!currentChannelId) {
        appendLog('Cannot add to history: No channel ID detected.');
      }
    }
  });

 
    chatOptionsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isMenuOpen = chatOptionsMenu.style.display === 'block';
    chatOptionsMenu.style.display = isMenuOpen ? 'none' : 'block';
  });
  autoSaveToggle.addEventListener('change', () => {
    autoSaveReplies = autoSaveToggle.checked;
    chrome.storage.local.set({ autoSaveReplies: autoSaveReplies });
    appendLog(`Auto-save manual replies: ${autoSaveReplies ? 'ON' : 'OFF'}`);
    chatOptionsMenu.style.display = 'none';
  });
  window.addEventListener('click', () => {
    if (chatOptionsMenu.style.display === 'block') chatOptionsMenu.style.display = 'none';
  });
  chatbotToggle.addEventListener('click', () => {
    const isOpen = chatbotContent.style.display === 'block';
    chatbotContent.style.display = isOpen ? 'none' : 'block';
    chatbotToggle.classList.toggle('open', !isOpen);
    if (!isOpen) {
      chatInput.focus();
      setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
    }
  });
  async function saveChatHistory() {
    if (!currentChannelId) return;
    try {
      const result = await chrome.storage.local.get('allChatHistories');
      const allHistories = result.allChatHistories || {};
      allHistories[currentChannelId] = chatHistory;
      await chrome.storage.local.set({ allChatHistories: allHistories });
    } catch (error) {
      appendLog("Error saving chat history: " + error.message);
    }
  }
  const sendChatMessage = async () => {
    if (!currentChannelId) { appendLog("Cannot send message, no channel context."); return; }
    const userText = chatInput.value.trim();
    if (!userText) return;
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    renderChat();
    chatInput.value = '';
    appendLog('Chat (User): ' + userText);
    chatLoadingIndicator.style.display = 'flex';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    status.textContent = 'AI is thinking...';
    try {
      const { apiKey } = await chrome.storage.local.get(['apiKey']);
      if (!apiKey) throw new Error('API Key is missing');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: chatHistory })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiText = data.candidates[0].content.parts[0].text.trim();
        chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
        await saveChatHistory();
        renderChat();
        appendLog('Chat (AI): ' + aiText.substring(0, 40) + '...');
      } else {
        throw new Error(data.error?.message || 'No valid response from AI');
      }
    } catch (err) {
      appendLog('Chat error: ' + err.message);
      chatMessages.innerHTML += `<div class="chat-message" style="color:var(--danger);">${err.message}</div>`;
    } finally {
      chatLoadingIndicator.style.display = 'none';
      status.textContent = isRunning ? `Running: ${currentMode}` : 'Ready';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  };
  sendChat.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
  function renderChat() {
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
      const div = document.createElement('div');
      div.classList.add('chat-message', msg.role === 'user' ? 'user' : 'model');
      div.textContent = msg.parts[0].text;
      chatMessages.appendChild(div);
    });
    chatMessages.appendChild(chatLoadingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  clearChatBtn.addEventListener('click', async () => {
    if (!currentChannelId) return;
    chatHistory = [];
    renderChat();
    try {
        const result = await chrome.storage.local.get('allChatHistories');
        const allHistories = result.allChatHistories || {};
        delete allHistories[currentChannelId];
        await chrome.storage.local.set({ allChatHistories: allHistories });
        appendLog(`Chat history cleared for channel: ${currentChannelId.substring(0,10)}...`);
    } catch (error) {
        appendLog("Error clearing chat history: " + error.message);
    }
    chatOptionsMenu.style.display = 'none';
  });
});
// --- END OF FILE sidebar.js ---