document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const apiKeyToggle = document.getElementById('apiKeyToggle');
  const apiKeyContent = document.getElementById('apiKeyContent');
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const replyText = document.getElementById('replyText');
  const applyBtn = document.getElementById('apply');
  const cancelBtn = document.getElementById('cancel');
  const logBox = document.getElementById('logBox');
  const clearLog = document.getElementById('clearLog');
  const customPrompt = document.getElementById('customPrompt');
  const savePromptBtn = document.getElementById('savePrompt');
  const resetPromptBtn = document.getElementById('resetPrompt');
  const promptStatus = document.getElementById('promptStatus');

  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  let isRunning = false;
  let currentMode = 'continuous';

  // === 1. COLLAPSIBLE API KEY ===
  apiKeyToggle.addEventListener('click', () => {
    const isOpen = apiKeyContent.style.display === 'block';
    apiKeyContent.style.display = isOpen ? 'none' : 'block';
    apiKeyToggle.classList.toggle('open', !isOpen);
  });

  // === 2. MODE TOGGLE ===
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });

  // === LOAD DATA ===
  chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    customPrompt.value = result.customPrompt || DEFAULT_PROMPT;
    promptStatus.textContent = result.customPrompt ? 'Prompt tùy chỉnh' : 'Prompt mặc định';
  });

  // === LOADING STATE ===
  function setProcessing(processing) {
    document.body.classList.toggle('processing', processing);
    document.body.classList.toggle('loading', processing);
  }

  // === SAVE KEY ===
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      setProcessing(true);
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'Đã lưu Key!';
        setTimeout(() => status.textContent = 'Ready', 1500);
        setProcessing(false);
      });
    }
  });

  // === SAVE PROMPT ===
  savePromptBtn.addEventListener('click', () => {
    const p = customPrompt.value.trim();
    if (p) {
      setProcessing(true);
      chrome.storage.local.set({ customPrompt: p }, () => {
        promptStatus.textContent = 'Đã lưu!';
        promptStatus.style.color = '#00ff00';
        setTimeout(() => {
          promptStatus.textContent = 'Prompt tùy chỉnh';
          promptStatus.style.color = '#00ffff';
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
      promptStatus.textContent = 'Đã khôi phục mặc định';
      setTimeout(() => setProcessing(false), 800);
    });
  });

  // === START ===
  startBtn.addEventListener('click', () => {
    setProcessing(true);
    chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
      if (!result.apiKey) {
        status.textContent = 'Thiếu API Key!';
        setProcessing(false);
        return;
      }
      const prompt = result.customPrompt || DEFAULT_PROMPT;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'start',
          mode: currentMode,
          apiKey: result.apiKey,
          prompt
        });
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = `Running: ${currentMode}`;
        appendLog('Started...');
        setProcessing(false);
      });
    });
  });

  // === STOP ===
  stopBtn.addEventListener('click', () => {
    setProcessing(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
    });
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = 'Stopped';
    preview.style.display = 'none';
    appendLog('Stopped.');
    setProcessing(false);
  });

  // === PREVIEW ===
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'showPreview') {
      preview.style.display = 'block';
      replyText.textContent = msg.reply;
      appendLog('Preview ready');
    }
    if (msg.action === 'log') appendLog(msg.text);
  });

  applyBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'applyReply', reply: replyText.textContent });
    });
    preview.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'nextComment' });
    });
    preview.style.display = 'none';
  });

  // === LOG ===
  function appendLog(msg) {
    const t = new Date().toLocaleTimeString();
    logBox.textContent += `[${t}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }
  clearLog.addEventListener('click', () => logBox.textContent = '');
});