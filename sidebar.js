// sidebar.js - ĐÃ CẬP NHẬT VỚI PROMPT TÙY CHỈNH

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const modeSelect = document.getElementById('mode');
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const replyText = document.getElementById('replyText');
  const applyBtn = document.getElementById('apply');
  const cancelBtn = document.getElementById('cancel');
  const logBox = document.getElementById('logBox');
  const clearLog = document.getElementById('clearLog');

  // MỚI: Prompt Editor
  const customPrompt = document.getElementById('customPrompt');
  const savePromptBtn = document.getElementById('savePrompt');
  const resetPromptBtn = document.getElementById('resetPrompt');
  const promptStatus = document.getElementById('promptStatus');

  // Prompt mặc định
  const DEFAULT_PROMPT = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

  // Load saved data
  chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.customPrompt) {
      customPrompt.value = result.customPrompt;
      promptStatus.textContent = 'Đã tải prompt tùy chỉnh';
    } else {
      customPrompt.value = DEFAULT_PROMPT;
      promptStatus.textContent = 'Đang dùng prompt mặc định';
    }
  });

  // Save API Key
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'Đã lưu API Key!';
        setTimeout(() => status.textContent = 'Sẵn sàng', 2000);
      });
    }
  });

  // Save Custom Prompt
  savePromptBtn.addEventListener('click', () => {
    const prompt = customPrompt.value.trim();
    if (prompt) {
      chrome.storage.local.set({ customPrompt: prompt }, () => {
        promptStatus.textContent = 'Đã lưu prompt!';
        promptStatus.style.color = 'green';
        setTimeout(() => {
          promptStatus.textContent = 'Prompt đã được lưu';
          promptStatus.style.color = '#0066cc';
        }, 2000);
      });
    }
  });

  // Reset Prompt
  resetPromptBtn.addEventListener('click', () => {
    customPrompt.value = DEFAULT_PROMPT;
    chrome.storage.local.remove('customPrompt', () => {
      promptStatus.textContent = 'Đã khôi phục prompt mặc định';
      promptStatus.style.color = '#0066cc';
    });
  });

  let isRunning = false;
  let currentMode = 'continuous';

  // Start
  startBtn.addEventListener('click', () => {
    currentMode = modeSelect.value;
    chrome.storage.local.get(['apiKey', 'customPrompt'], (result) => {
      if (!result.apiKey) {
        status.textContent = 'Lỗi: Chưa nhập API Key!';
        return;
      }

      const promptToUse = result.customPrompt || DEFAULT_PROMPT;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'start', 
          mode: currentMode, 
          apiKey: result.apiKey,
          prompt: promptToUse  // GỬI PROMPT MỚI
        });
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = `Đang chạy: ${currentMode === 'continuous' ? 'Tự động' : 'Thủ công'}`;
        appendLog('Bắt đầu tự động reply...');
      });
    });
  });

  // Stop
  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
    });
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = 'Đã dừng';
    preview.style.display = 'none';
    appendLog('Đã dừng.');
  });

  // Manual: Preview
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'showPreview') {
      preview.style.display = 'block';
      replyText.textContent = message.reply;
      appendLog('Preview: ' + message.reply.substring(0, 50) + '...');
    }
  });

  applyBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'applyReply', 
        reply: replyText.textContent 
      });
    });
    preview.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'nextComment' });
    });
    preview.style.display = 'none';
  });

  // Log System
  function appendLog(msg) {
    const time = new Date().toLocaleTimeString();
    logBox.textContent += `[${time}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  clearLog.addEventListener('click', () => logBox.textContent = '');

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'log') appendLog(message.text);
  });
});