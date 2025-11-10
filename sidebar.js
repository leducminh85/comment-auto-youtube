// --- START OF FILE sidebar.js ---

document.addEventListener('DOMContentLoaded', () => {
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

  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  let isRunning = false;
  let currentMode = 'continuous';
  let currentContextMode = 'prompt';
  let autoSaveReplies = true; // <-- NEW: State variable for the new option

  // === COLLAPSIBLES ===
  apiKeyToggle.addEventListener('click', () => {
    const isOpen = apiKeyContent.style.display === 'block';
    apiKeyContent.style.display = isOpen ? 'none' : 'block';
    apiKeyToggle.classList.toggle('open', !isOpen);
  });

  // === MODE TOGGLE ===
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      appendLog(`Mode switched to: ${currentMode}`);
    });
  });

  // === CONTEXT UI SWITCHER ===
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

  // === LOAD DATA ===
  // UPDATED: Load the new autoSaveReplies setting
  chrome.storage.local.get(['apiKey', 'customPrompt', 'contextMode', 'chatHistory', 'autoSaveReplies'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Status: Custom' : 'Status: Default';

    currentContextMode = result.contextMode || 'prompt';
    contextModeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.contextMode === currentContextMode);
    });
    updateContextUI(currentContextMode);
    
    if (result.chatHistory) {
      chatHistory = result.chatHistory;
      renderChat();
    }
    
    // Load and apply the setting, default to true if not set
    autoSaveReplies = result.autoSaveReplies !== false;
    autoSaveToggle.checked = autoSaveReplies;
  });

  // === SAVE KEY, SAVE PROMPT, RESET PROMPT functions (no changes here) ...
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'API Key Saved!';
        setTimeout(() => status.textContent = 'Ready', 2000);
        apiKeyContent.style.display = 'none';
        apiKeyToggle.classList.remove('open');
      });
    } else {
      status.textContent = 'API Key cannot be empty!';
      status.style.color = 'var(--danger)';
      setTimeout(() => {
        status.textContent = 'Ready';
        status.style.color = 'var(--success)';
      }, 2000);
    }
  });

  savePromptBtn.addEventListener('click', () => {
    const p = customPrompt.value.trim();
    if (p) {
      chrome.storage.local.set({ customPrompt: p }, () => {
        promptStatus.textContent = 'Saved!';
        promptStatus.style.color = 'var(--success)';
        setTimeout(() => {
          promptStatus.textContent = 'Status: Custom';
          promptStatus.style.color = 'var(--text-muted)';
        }, 1500);
      });
    }
  });

  resetPromptBtn.addEventListener('click', () => {
    customPrompt.value = DEFAULT_PROMPT;
    chrome.storage.local.remove('customPrompt', () => {
      promptStatus.textContent = 'Restored to default!';
      setTimeout(() => {
        promptStatus.textContent = 'Status: Default';
      }, 1500);
    });
  });

  // === TOGGLE START/STOP functions (no changes here) ...
  toggleBtn.addEventListener('click', () => {
    if (isRunning) stopProcessing();
    else startProcessing();
  });

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


  // === PREVIEW & MESSAGES ===
  // UPDATED: The listener for 'addToChatHistory'
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
      // NOW, IT CHECKS THE OPTION BEFORE SAVING
      if (currentContextMode === 'chatbot' && autoSaveReplies) {
        const { comment, reply } = msg;
        chatHistory.push({ role: 'user', parts: [{ text: comment }] });
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        saveChatHistory();
        renderChat();
        appendLog('Manual reply saved to chat context.');
      }
    }
  });

  // === PREVIEW BUTTONS (no changes here) ...
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

  // === LOG (no changes here) ...
  function appendLog(msg) {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  clearLog.addEventListener('click', () => {
    logBox.textContent = '';
    appendLog('Log cleared');
  });

  // === CHATBOT AI ===
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotContent = document.getElementById('chatbotContent');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
  let chatHistory = [];
  
  // ▼▼▼ NEW: GETTING NEW MENU ELEMENTS ▼▼▼
  const chatOptionsBtn = document.getElementById('chatOptionsBtn');
  const chatOptionsMenu = document.getElementById('chatOptionsMenu');
  const autoSaveToggle = document.getElementById('autoSaveToggle');
  const clearChatBtn = document.getElementById('clearChatBtn'); // Note the ID change
  
  // Logic to open/close the new menu
  chatOptionsBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent window listener from closing it immediately
    const isMenuOpen = chatOptionsMenu.style.display === 'block';
    chatOptionsMenu.style.display = isMenuOpen ? 'none' : 'block';
  });
  
  // Logic to handle the new toggle switch
  autoSaveToggle.addEventListener('change', () => {
    autoSaveReplies = autoSaveToggle.checked;
    chrome.storage.local.set({ autoSaveReplies: autoSaveReplies });
    appendLog(`Auto-save manual replies: ${autoSaveReplies ? 'ON' : 'OFF'}`);
    chatOptionsMenu.style.display = 'none'; // Close menu after action
  });
  
  // Close menu when clicking outside
  window.addEventListener('click', () => {
    if (chatOptionsMenu.style.display === 'block') {
      chatOptionsMenu.style.display = 'none';
    }
  });
  // ▲▲▲ END OF NEW MENU LOGIC ▲▲▲

  chatbotToggle.addEventListener('click', () => {
    const isOpen = chatbotContent.style.display === 'block';
    chatbotContent.style.display = isOpen ? 'none' : 'block';
    chatbotToggle.classList.toggle('open', !isOpen);
    
    if (!isOpen) {
      chatInput.focus();
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 50);
    }
  });

  const sendChatMessage = async () => {
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
      saveChatHistory();
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

  function saveChatHistory() {
    chrome.storage.local.set({ chatHistory });
  }

  // UPDATED: Event listener for the new clear button
  clearChatBtn.addEventListener('click', () => {
    chatHistory = [];
    renderChat();
    chrome.storage.local.remove('chatHistory');
    appendLog('Chat history cleared');
    chatOptionsMenu.style.display = 'none'; // Close menu after action
  });
});
// --- END OF FILE sidebar.js ---