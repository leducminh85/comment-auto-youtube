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

  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  let isRunning = false;
  let currentMode = 'continuous';

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

  // === LOAD DATA ===
  chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Tùy chỉnh' : 'Mặc định';
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
});