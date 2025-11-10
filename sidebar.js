// --- START OF FILE sidebar.js ---

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyToggle = document.getElementById('apiKeyToggle');
  const apiKeyContent = document.getElementById('apiKeyContent');
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const modeBtns = document.querySelectorAll('.mode-btn');
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
  
  // **UPDATE**: Thêm selector cho context mode
  const contextModeBtns = document.querySelectorAll('.context-mode-btn');

  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  let isRunning = false;
  let currentMode = 'continuous';
  let currentContextMode = 'prompt'; // **UPDATE**: Mặc định

  // === COLLAPSIBLE API KEY ===
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

  // **UPDATE**: === CONTEXT MODE TOGGLE ===
  contextModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      contextModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentContextMode = btn.dataset.contextMode;
      chrome.storage.local.set({ contextMode: currentContextMode });
      appendLog(`Context source switched to: ${currentContextMode}`);
    });
  });

  // === LOAD DATA ===
  // **UPDATE**: Lấy thêm `contextMode` khi load
  chrome.storage.local.get(['apiKey', 'customPrompt', 'contextMode'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Tùy chỉnh' : 'Mặc định';

    // **UPDATE**: Cập nhật UI cho context mode đã lưu
    currentContextMode = result.contextMode || 'prompt';
    contextModeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.contextMode === currentContextMode);
    });
  });

  // === SAVE KEY ===
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      setProcessing(true);
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'Đã lưu Key!';
        setTimeout(() => status.textContent = 'Ready', 2000);
        setProcessing(false);
        apiKeyContent.style.display = 'none';
        apiKeyToggle.classList.remove('open');
      });
    } else {
      status.textContent = 'Key không trống!';
      setTimeout(() => status.textContent = 'Ready', 2000);
    }
  });

  // === SAVE PROMPT ===
  savePromptBtn.addEventListener('click', () => {
    const p = customPrompt.value.trim();
    if (p) {
      setProcessing(true);
      chrome.storage.local.set({ customPrompt: p }, () => {
        promptStatus.textContent = 'Đã lưu!';
        promptStatus.style.color = 'var(--success)';
        setTimeout(() => {
          promptStatus.textContent = 'Tùy chỉnh';
          promptStatus.style.color = 'var(--neon-cyan)';
          setProcessing(false);
        }, 1500);
      });
    }
  });

  // === RESET PROMPT ===
  resetPromptBtn.addEventListener('click', () => {
    setProcessing(true);
    customPrompt.value = DEFAULT_PROMPT;
    chrome.storage.local.remove('customPrompt', () => {
      promptStatus.textContent = 'Khôi phục mặc định';
      setTimeout(() => {
        promptStatus.textContent = 'Mặc định';
        setProcessing(false);
      }, 800);
    });
  });

  // === TOGGLE START/STOP ===
  toggleBtn.addEventListener('click', () => {
    if (isRunning) {
      stopProcessing();
    } else {
      startProcessing();
    }
  });

  function startProcessing() {
    setProcessing(true);
    chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
      if (!result.apiKey) {
        status.textContent = 'Thiếu API Key!';
        setTimeout(() => status.textContent = 'Ready', 2000);
        setProcessing(false);
        return;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          status.textContent = 'Không có tab';
          setProcessing(false);
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'start',
          mode: currentMode,
          apiKey: result.apiKey,
          prompt: result.customPrompt || DEFAULT_PROMPT
        });
        
        isRunning = true;
        toggleBtn.textContent = 'Stop';
        toggleBtn.classList.add('stop-btn');
        status.textContent = `Running: ${currentMode}`;
        status.style.color = 'var(--success)';
        appendLog(`Started in ${currentMode} mode`);
        setProcessing(false);
      });
    });
  }

  function stopProcessing() {
    setProcessing(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
      }
    });
    
    isRunning = false;
    toggleBtn.textContent = 'Start';
    toggleBtn.classList.remove('stop-btn');
    status.textContent = 'Stopped';
    status.style.color = 'var(--warning)';
    preview.style.display = 'none';
    appendLog('Stopped');
    setProcessing(false);
  }

  // === PREVIEW & MESSAGES ===
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'showPreview') {
      preview.style.display = 'block';
      commentText.textContent = msg.comment;
      replyText.value = msg.reply;
      replyText.focus();
      replyText.select();
      appendLog('Preview ready');
    }
    
    if (msg.action === 'hidePreview') {
      preview.style.display = 'none';
    }
    
    if (msg.action === 'setLoading') {
      status.textContent = msg.loading ? 'Loading...' : `Running: ${currentMode}`;
    }
    
    if (msg.action === 'log') {
      appendLog(msg.text);
    }
  });

  // === RE-GENERATE ===
  regenerateBtn.addEventListener('click', () => {
    status.textContent = 'Regenerating...';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'regenerate' });
      }
    });
  });

  // === APPLY ===
  applyBtn.addEventListener('click', () => {
    const editedText = replyText.value;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'applyReply', 
          reply: editedText
        });
      }
    });
    preview.style.display = 'none';
  });

  // === SKIP → chuyển sang comment mới ===
  cancelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'skipAndNext' });
      }
    });
    preview.style.display = 'none';
    appendLog('Skipped → next comment');
  });

  // === LOG ===
  function appendLog(msg) {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  // === CLEAR LOG ===
  clearLog.addEventListener('click', () => {
    logBox.textContent = '';
    appendLog('Log cleared');
  });

  // === LOADING STATE ===
  function setProcessing(processing) {
    document.body.classList.toggle('processing', processing);
  }

  // === CHATBOT AI ===
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotContent = document.getElementById('chatbotContent');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const clearChatBtn = document.getElementById('clearChat');

  let chatHistory = [];

  // Load chat history
  chrome.storage.local.get(['chatHistory'], (result) => {
    if (result.chatHistory) {
      chatHistory = result.chatHistory;
      renderChat();
    }
  });

  // Toggle chatbot
  chatbotToggle.addEventListener('click', () => {
    const isOpen = chatbotContent.style.display === 'block';
    chatbotContent.style.display = isOpen ? 'none' : 'block';
    chatbotToggle.classList.toggle('open', !isOpen);
    if (!isOpen) chatInput.focus();
  });

  // Send message
  sendChat.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  async function sendChatMessage() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Add user message
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    renderChat();
    chatInput.value = '';
    appendLog('Chat: ' + userText);

    setProcessing(true);
    status.textContent = 'AI đang suy nghĩ...';

    try {
      const result = await chrome.storage.local.get(['apiKey']);
      const apiKey = result.apiKey;
      if (!apiKey) throw new Error('Thiếu API Key');

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
        appendLog('AI: ' + aiText.substring(0, 50) + '...');
      } else {
        throw new Error(data.error?.message || 'Không có phản hồi');
      }
    } catch (err) {
      appendLog('Chat error: ' + err.message);
      chatMessages.innerHTML += `<div style="color:#f66; font-style:italic;">Lỗi: ${err.message}</div>`;
    } finally {
      setProcessing(false);
      status.textContent = isRunning ? `Running: ${currentMode}` : 'Ready';
      saveChatHistory();
    }
  }

  // Render chat
  function renderChat() {
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
      const div = document.createElement('div');
      div.style.margin = '6px 0';
      div.style.padding = '6px 8px';
      div.style.borderRadius = '6px';
      div.style.maxWidth = '90%';
      div.style.alignSelf = msg.role === 'user' ? 'flex-end' : 'flex-start';
      div.style.background = msg.role === 'user' ? 'var(--neon-purple)' : '#333';
      div.style.color = msg.role === 'user' ? '#000' : 'var(--text)';
      div.style.fontSize = '11px';
      div.textContent = msg.parts[0].text;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Save chat history
  function saveChatHistory() {
    chrome.storage.local.set({ chatHistory });
  }

  // Clear chat
  clearChatBtn.addEventListener('click', () => {
    chatHistory = [];
    renderChat();
    chrome.storage.local.remove('chatHistory');
    appendLog('Chat history cleared');
  });
});
// --- END OF FILE sidebar.js ---