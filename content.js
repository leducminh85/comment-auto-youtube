let isRunning = false;
let currentMode = 'continuous';
let apiKey = '';
let intervalId = null;
let currentCommentEl = null;

const SCROLL_STEP = 600;

console.log("✅ content.js loaded");

chrome.runtime.onMessage.addListener((message) => {
  console.log("📩 Received message:", message);
});


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
  if (currentMode === 'continuous') {
    intervalId = setInterval(processNextComment, 4000);
  } else {
    processNextComment();
  }
}

function stopProcessing() {
  if (intervalId) clearInterval(intervalId);
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
  return Array.from(document.querySelectorAll('ytcp-comment'))
    .filter(comment => {
      // Chỉ lấy comment chưa có reply (không có ytcp-comment-reply)
      const hasReply = comment.querySelector('ytcp-comment-reply') !== null;
      const isReplied = comment.classList.contains('auto-replied');
      return !hasReply && !isReplied;
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

  if (currentMode === 'continuous') {
    await autoReply(currentCommentEl, reply);
    markAsReplied(currentCommentEl);
    scrollToComment(currentCommentEl);
    setTimeout(moveToNextComment, 2000);
  } else {
    // Manual mode: Hiển thị preview
    chrome.runtime.sendMessage({ action: 'showPreview', reply });
    await openReplyBox(currentCommentEl);
  }
}

// === MỞ HỘP REPLY ===
async function openReplyBox(commentEl) {
  hideReplyBox(); // Đóng hộp cũ
  const replyBtn = commentEl.querySelector('#reply-button button');
  if (replyBtn) {
    replyBtn.click();
    // Đợi hộp reply hiện
    await new Promise(r => setTimeout(r, 800));
  }
}

// === ÁP DỤNG REPLY (Manual) ===
async function applyReplyToCurrent(replyText) {
  if (!currentCommentEl) return;
  await openReplyBox(currentCommentEl);
  await fillAndSendReply(replyText);
  markAsReplied(currentCommentEl);
  moveToNextComment();
}

// === TỰ ĐỘNG REPLY (Continuous) ===
async function autoReply(commentEl, replyText) {
  await openReplyBox(commentEl);
  await fillAndSendReply(replyText);
}

// === ĐIỀN + GỬI REPLY ===
async function fillAndSendReply(replyText) {
  const replyInput = document.querySelector('ytcp-comment-reply #reply-input');
  const sendButton = document.querySelector('ytcp-comment-reply #submit-button button');

  if (!replyInput || !sendButton) {
    console.error('Không tìm thấy input hoặc nút gửi');
    return false;
  }

  // Focus và nhập
  replyInput.focus();
  document.execCommand('insertText', false, replyText);

  // Đợi 1s để YouTube xử lý
  await new Promise(r => setTimeout(r, 1000));

  // Kiểm tra nút gửi có enable không
  if (sendButton.getAttribute('aria-disabled') === 'false') {
    sendButton.click();
    await new Promise(r => setTimeout(r, 1500));
    return true;
  }
  return false;
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
  const prompt = `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "${commentText}"`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text.trim();
    }
  } catch (error) {
    console.error('Gemini API error:', error);
  }
  return null;
}