let isRunning = false;
let currentMode = 'continuous';
let apiKey = '';
let currentCommentEl = null;

const SCROLL_STEP = 600;

console.log("✅ content.js loaded");

function logToSidebar(text) {
  chrome.runtime.sendMessage({ action: 'log', text });
}

// Listen messages from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    isRunning = true;
    currentMode = message.mode;
    apiKey = message.apiKey;
    startProcessing();
  } else if (message.action === 'stop') {
    isRunning = false;
    stopProcessing();
    hideReplyBox();
  } else if (message.action === 'applyReply') {
    applyReplyToCurrent(message.reply);
  } else if (message.action === 'nextComment') {
    moveToNextComment();
  }
});

function startProcessing() {
  chrome.runtime.sendMessage({ action: 'log', text: 'content.js: startProcessing() called' });

  hideReplyBox();
  
  // Cả hai mode đều gọi 1 lần (không setInterval)
  processNextComment();
}

function stopProcessing() {
  hideReplyBox();
}

function hideReplyBox() {
  const openReply = document.querySelector('ytcp-comment-reply');
  if (openReply) {
    const cancel = openReply.querySelector('#cancel-button');
    if (cancel) cancel.click();
  }
}

// === TÌM COMMENT CHƯA REPLY ===
function getUnrepliedComments() {
  const allThreads = Array.from(document.querySelectorAll('ytcp-comment-thread'));

  return allThreads.filter(thread => {
    const mainComment = thread.querySelector('ytcp-comment#comment');
    const hasRepliesSection = thread.querySelector('ytcp-comment-replies');
    const repliedClass = mainComment?.classList.contains('auto-replied');

    // 1️⃣ Bỏ qua comment đã được đánh dấu là "auto-replied"
    if (repliedClass) return false;

    // 2️⃣ Nếu có khối "ytcp-comment-replies" => đã có ít nhất 1 phần hồi
    if (hasRepliesSection && hasRepliesSection.querySelector('ytcp-comment')) return false;

    // 3️⃣ Ngược lại: chưa có phần hồi
    return true;
  });
}

// === LẤY COMMENT TIẾP THEO ===
async function processNextComment() {
  if (!isRunning) return;

  const unreplied = getUnrepliedComments();
  if (unreplied.length === 0) {
    console.log('Không còn comment chưa reply. Cuộn xuống...');
    window.scrollBy(0, SCROLL_STEP);
    setTimeout(processNextComment, 3000);
    return;
  }

  currentCommentEl = unreplied[0];
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  if (!commentText) return;

  console.log('Đang xử lý comment:', commentText);

  const reply = await generateReply(commentText);
  if (!reply) {
    markAsFailed(currentCommentEl);
    moveToNextComment();
    return;
  }

  // Hiển thị preview cho cả continuous & manual
  chrome.runtime.sendMessage({ action: 'showPreview', reply });
  
  // Mở reply box
  await openReplyBox(currentCommentEl);

  // Sự khác biệt ở đây:
  if (currentMode === 'continuous') {
    // Continuous: Tự động apply sau 1s
    setTimeout(() => {
      autoApplyReply(reply);
    }, 1000);
  }
  // Manual mode: chờ user bấm apply button
}

// === MỞ HỘP REPLY ===
async function openReplyBox(commentEl) {
  hideReplyBox();
  commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 400));

  const replyBtn = commentEl.querySelector('#reply-button button');
  if (!replyBtn) {
    chrome.runtime.sendMessage({ action: 'log', text: '❌ Không thấy nút Phản hồi trong comment hiện tại.' });
    return false;
  }

  replyBtn.click();
  await new Promise(r => setTimeout(r, 500));
  return true;
}

// === CHỜ HỘP INPUT/SUBMIT XUẤT HIỆN TRONG ĐÚNG COMMENT ===
async function waitForReplyBoxIn(commentEl, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const boxContainer = commentEl.querySelector('#reply-dialog-container');
    const textarea = boxContainer?.querySelector('textarea#textarea');
    const sendBtn = boxContainer?.querySelector('#submit-button button');
    if (textarea && sendBtn) return { boxContainer, textarea, sendBtn };
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

// === ĐIỀN + GỬI, SCOPE THEO COMMENT ===
async function fillAndSendReplyIn(commentEl, replyText) {
  const found = await waitForReplyBoxIn(commentEl, 6000);
  if (!found) {
    chrome.runtime.sendMessage({ action: 'log', text: '❌ Không tìm thấy input hoặc nút gửi (hộp chưa render kịp).' });
    return false;
  }

  const { textarea, sendBtn } = found;

  textarea.focus();
  textarea.value = replyText;
  textarea.dispatchEvent(new Event('input', { bubbles: true })); // kích hoạt binding

  await new Promise(r => setTimeout(r, 800)); // cho UI cập nhật

  const disabled = sendBtn.getAttribute('aria-disabled') === 'true' || sendBtn.disabled;
  if (disabled) {
    chrome.runtime.sendMessage({ action: 'log', text: '⚠️ Nút gửi đang bị disabled.' });
    return false;
  }

  sendBtn.click();
  chrome.runtime.sendMessage({ action: 'log', text: '✅ Gửi phản hồi thành công.' });
  await new Promise(r => setTimeout(r, 1200));
  return true;
}

// === CONTINUOUS MODE: TỰ ĐỘNG APPLY (HÀM MỚI) ===
async function autoApplyReply(replyText) {
  if (!currentCommentEl) return;

  chrome.runtime.sendMessage({ 
    action: 'log', 
    text: '🤖 Auto-applying...' 
  });

  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  
  if (ok) {
    markAsReplied(currentCommentEl);
  } else {
    markAsFailed(currentCommentEl);
  }

  // Ẩn preview
  chrome.runtime.sendMessage({ action: 'hidePreview' });
  
  // Sang comment tiếp theo
  moveToNextComment();
}

// === ÁP DỤNG REPLY (MANUAL MODE) ===
async function applyReplyToCurrent(replyText) {
  if (!currentCommentEl) return;

  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  
  if (ok) {
    markAsReplied(currentCommentEl);
  } else {
    markAsFailed(currentCommentEl);
  }

  // Ẩn preview
  chrome.runtime.sendMessage({ action: 'hidePreview' });
  
  // Sang comment tiếp theo
  moveToNextComment();
}

// === ĐÁNH DẤU ĐÃ REPLY ===
function markAsReplied(el) {
  el.classList.add('auto-replied');
  el.style.borderLeft = '4px solid #0f0';
}

function markAsFailed(el) {
  el.style.borderLeft = '4px solid #f00';
}

// === CHUYỂN COMMENT TIẾP ===
function moveToNextComment() {
  window.scrollBy(0, 200);
  setTimeout(() => {
    if (isRunning) processNextComment();
  }, 1500);
}

function scrollToComment(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// === GỌI GEMINI API ===
async function generateReply(commentText) {
  // Lấy prompt từ message (nếu có), nếu không thì dùng mặc định
  const stored = await new Promise(resolve => {
    chrome.storage.local.get(['customPrompt'], resolve);
  });
  const rawPrompt = stored.customPrompt || `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "${commentText}"`;

  // Thay thế {{COMMENT}} nếu có
  const prompt = rawPrompt.replace(/{{COMMENT}}/g, commentText);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      console.error('Gemini response error:', data);
      chrome.runtime.sendMessage({ action: 'log', text: 'Gemini trả về lỗi định dạng.' });
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    chrome.runtime.sendMessage({ action: 'log', text: 'Lỗi gọi Gemini: ' + error.message });
  }
  return null;
}