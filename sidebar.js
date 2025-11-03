// Load API Key khi mở
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

  // Load saved key
  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
  });

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ apiKey: key }, () => {
        status.textContent = 'Đã lưu API Key!';
        setTimeout(() => status.textContent = 'Sẵn sàng', 2000);
      });
    }
  });

  let isRunning = false;
  let currentMode = 'continuous';

  startBtn.addEventListener('click', () => {
    currentMode = modeSelect.value;
    chrome.storage.local.get(['apiKey'], (result) => {
      if (!result.apiKey) {
        status.textContent = 'Lỗi: Chưa nhập API Key!';
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'start', 
          mode: currentMode, 
          apiKey: result.apiKey 
        });
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = `Đang chạy: ${currentMode === 'continuous' ? 'Tự động' : 'Thủ công'}`;
      });
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
    });
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = 'Đã dừng';
    preview.style.display = 'none';
  });

  // Manual mode: nhận preview
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'showPreview') {
      preview.style.display = 'block';
      replyText.textContent = message.reply;
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
   const logBox = document.getElementById('logBox');
  const clearLog = document.getElementById('clearLog');

  // Ghi log
  function appendLog(msg) {
    const time = new Date().toLocaleTimeString();
    logBox.textContent += `[${time}] ${msg}\n`;
    logBox.scrollTop = logBox.scrollHeight;
  }

  clearLog.addEventListener('click', () => logBox.textContent = '');

  // Lắng nghe log từ content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'log') appendLog(message.text);
    if (message.action === 'showPreview') {
      preview.style.display = 'block';
      replyText.textContent = message.reply;
      appendLog('Preview reply received.');
    }
  });

  // Khi nhấn Start / Stop thì thêm log
  startBtn.addEventListener('click', () => appendLog('Started replying...'));
  stopBtn.addEventListener('click', () => appendLog('Stopped.'));
});