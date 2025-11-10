// --- START OF FILE sidebar.js ---

document.addEventListener('DOMContentLoaded', () => {
  // --- Element Selectors (no changes) ---
  const apiKeyToggle = document.getElementById('apiKeyToggle');
  const apiKeyContent = document.getElementById('apiKeyContent');
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const modeBtns = document.querySelectorAll('.mode-toggle .toggle-btn[data-mode]');
  const toggleBtn = document.getElementById('toggleBtn');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const commentText = document.getElementById('commentText');
  const replyText = document.getElementById('replyText');
  const regenerateBtn = document.getElementById('regenerateBtn');
  const applyBtn = document.getElementById('applyBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const logBox = document.getElementById('logBox');
  const clearLog = document.getElementById('clearLog');
  const customPrompt = document.getElementById('customPrompt');
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

  // --- State Variables (updated) ---
  let isRunning = false;
  let currentMode = 'continuous';
  let currentContextMode = 'prompt';
  let autoSaveReplies = true;
  
  // NEW: State variables for per-channel history
  let currentChannelId = null;
  let chatHistory = []; // This will now hold the history for the *current* channel only

  // === NEW: HELPER FUNCTIONS ===
  /**
   * Gets the YouTube Channel ID from the current tab's URL.
   * @returns {Promise<string|null>} A promise that resolves with the channel ID or null.
   */
  async function getCurrentChannelId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const match = url.match(/studio\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      }
    } catch (error) {
      console.error("Error getting channel ID:", error);
      return null;
    }
    return null;
  }
  
  /**
   * Disables the chatbot UI if no channel is detected.
   */
  function disableChatbotUI(message) {
    chatbotToggle.style.opacity = '0.5';
    chatbotToggle.style.pointerEvents = 'none';
    const originalTitle = chatbotToggle.querySelector('span').textContent;
    chatbotToggle.querySelector('span').textContent = message;
    // Restore title after a few seconds
    setTimeout(() => {
        chatbotToggle.querySelector('span').textContent = originalTitle;
    }, 4000);
  }

  // === UPDATED: INITIALIZATION LOGIC ===
  async function initializeSidebar() {
    currentChannelId = await getCurrentChannelId();

    // Load general settings
    const result = await chrome.storage.local.get(['apiKey', 'customPrompt', 'contextMode', 'autoSaveReplies', 'allChatHistories']);
    
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Status: Custom' : 'Status: Default';
    
    currentContextMode = result.contextMode || 'prompt';
    contextModeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.contextMode === currentContextMode);
    });
    updateContextUI(currentContextMode);
    
    autoSaveReplies = result.autoSaveReplies !== false;
    autoSaveToggle.checked = autoSaveReplies;

    // Per-channel logic
    if (currentChannelId) {
      const allHistories = result.allChatHistories || {};
      chatHistory = allHistories[currentChannelId] || []; // Load history for the current channel
      appendLog(`Loaded context for channel: ${currentChannelId.substring(0,10)}...`);
    } else {
      disableChatbotUI("Không tìm thấy kênh YouTube");
      appendLog("Not on a valid YouTube Studio channel page.");
    }
    renderChat();
  }
  
  // Start initialization when the sidebar is loaded
  initializeSidebar();


  // --- Event Listeners and other functions (with necessary updates) ---

  // === COLLAPSIBLES, MODE TOGGLE, CONTEXT UI (no changes) ===
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

  // === SAVE KEY, PROMPT, etc. (no changes) ===
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
  
  // === TOGGLE START/STOP (no changes) ===
  toggleBtn.addEventListener('click', () => { isRunning ? stopProcessing() : startProcessing(); });
  function startProcessing() { /* ... no changes ... */ }
  function stopProcessing() { /* ... no changes ... */ }
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
        if (!tabs[0]) {
          status.textContent = 'No active tab found';
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'start', mode: currentMode, apiKey: result.apiKey });
        
        isRunning = true;
        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-danger');
        status.textContent = `Running: ${currentMode}`;
        status.style.color = 'var(--success)';
        appendLog(`Started in ${currentMode} mode`);
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
    preview.style.display = 'none';
    appendLog('Stopped');
  }

  // === PREVIEW BUTTONS (no changes) ===
  regenerateBtn.addEventListener('click', () => { /* ... no changes ... */ });
  applyBtn.addEventListener('click', () => { /* ... no changes ... */ });
  cancelBtn.addEventListener('click', () => { /* ... no changes ... */ });
   regenerateBtn.addEventListener('click', () => {
    status.textContent = 'Regenerating...';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'regenerate' });
    });
  });
  applyBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'applyReply', reply: replyText.value });
    });
    preview.style.display = 'none';
  });
  cancelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'skipAndNext' });
    });
    preview.style.display = 'none';
    appendLog('Skipped → next comment');
  });

  // === LOG (no changes) ===
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
    if (msg.action === 'showPreview') {
      preview.style.display = 'block';
      commentText.textContent = msg.comment;
      replyText.value = msg.reply;
      replyText.focus();
      appendLog('Preview ready');
    } else if (msg.action === 'hidePreview') {
      preview.style.display = 'none';
    } else if (msg.action === 'setLoading') {
      status.textContent = msg.loading ? 'Loading...' : `Running: ${currentMode}`;
    } else if (msg.action === 'log') {
      appendLog(msg.text);
    } else if (msg.action === 'addToChatHistory') {
      if (currentChannelId && currentContextMode === 'chatbot' && autoSaveReplies) {
        const { comment, reply } = msg;
        chatHistory.push({ role: 'user', parts: [{ text: comment }] });
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        saveChatHistory(); // This now saves to the correct channel
        renderChat();
        appendLog('Manual reply saved to chat context.');
      }
    }
  });

  // === CHATBOT AI (major updates) ===
  
  // Menu logic (no changes)
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

  // UPDATED: Function to save history for the current channel
  async function saveChatHistory() {
    if (!currentChannelId) return; // Don't save if there's no channel context
    try {
      const result = await chrome.storage.local.get('allChatHistories');
      const allHistories = result.allChatHistories || {};
      allHistories[currentChannelId] = chatHistory; // Update the history for the current channel
      await chrome.storage.local.set({ allChatHistories: allHistories });
    } catch (error) {
      appendLog("Error saving chat history: " + error.message);
    }
  }

  const sendChatMessage = async () => {
    if (!currentChannelId) {
        appendLog("Cannot send message, no channel context.");
        return;
    }
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
        body: JSON.stringify({ contents: chatHistory }) // Send only the current channel's history
      });
      const data = await response.json();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiText = data.candidates[0].content.parts[0].text.trim();
        chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
        await saveChatHistory(); // Await the save operation
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
  
  // UPDATED: Clear history for the current channel only
  clearChatBtn.addEventListener('click', async () => {
    if (!currentChannelId) return;
    
    chatHistory = []; // Clear local state
    renderChat();
    
    // Remove from storage
    try {
        const result = await chrome.storage.local.get('allChatHistories');
        const allHistories = result.allChatHistories || {};
        delete allHistories[currentChannelId]; // Delete history for the current channel
        await chrome.storage.local.set({ allChatHistories: allHistories });
        appendLog(`Chat history cleared for channel: ${currentChannelId.substring(0,10)}...`);
    } catch (error) {
        appendLog("Error clearing chat history: " + error.message);
    }
    
    chatOptionsMenu.style.display = 'none';
  });
});
// --- END OF FILE sidebar.js ---