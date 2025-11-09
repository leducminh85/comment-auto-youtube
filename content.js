let isRunning = false;
let currentMode = 'continuous';
let apiKey = '';
let currentCommentEl = null;

const SCROLL_STEP = 600;

console.log("content.js loaded");

function logToSidebar(text) {
  chrome.runtime.sendMessage({ action: 'log', text });
}

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
  } else if (message.action === 'skipAndNext') {
    // ĐÁNH DẤU LÀ SKIP + ĐÓNG HỘP + CHUYỂN COMMENT MỚI
    if (currentCommentEl) {
      markAsSkipped(currentCommentEl);
    }
    hideReplyBox();
    currentCommentEl = null;
    chrome.runtime.sendMessage({ action: 'hidePreview' });
    moveToNextComment();
  } else if (message.action === 'regenerate') {
    regenerateCurrentReply();
  }
});

function startProcessing() {
  logToSidebar('content.js: startProcessing()');
  hideReplyBox();
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

// CẬP NHẬT: Loại bỏ cả comment đã reply và đã skip
function getUnrepliedComments() {
  const allThreads = Array.from(document.querySelectorAll('ytcp-comment-thread'));
  return allThreads.filter(thread => {
    const mainComment = thread.querySelector('ytcp-comment#comment');
    const hasRepliesSection = thread.querySelector('ytcp-comment-replies');
    const repliedClass = mainComment?.classList.contains('auto-replied');
    const skippedClass = mainComment?.classList.contains('auto-skipped');

    // Bỏ qua nếu đã reply HOẶC đã skip
    if (repliedClass || skippedClass) return false;
    if (hasRepliesSection && hasRepliesSection.querySelector('ytcp-comment')) return false;
    return true;
  });
}

async function processNextComment() {
  if (!isRunning) return;

  const unreplied = getUnrepliedComments();
  if (unreplied.length === 0) {
    console.log('Không còn comment. Cuộn xuống...');
    window.scrollBy(0, SCROLL_STEP);
    setTimeout(processNextComment, 3000);
    return;
  }

  currentCommentEl = unreplied[0];
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  if (!commentText) return;

  const reply = await generateReply(commentText);
  if (!reply) {
    markAsFailed(currentCommentEl);
    moveToNextComment();
    return;
  }

  chrome.runtime.sendMessage({ 
    action: 'showPreview', 
    reply: reply,
    comment: commentText
  });
  
  await openReplyBox(currentCommentEl);

  if (currentMode === 'continuous') {
    setTimeout(() => {
      autoApplyReply(reply);
    }, 1000);
  }
}

async function openReplyBox(commentEl) {
  hideReplyBox();
  commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 400));

  const replyBtn = commentEl.querySelector('#reply-button button');
  if (!replyBtn) {
    logToSidebar('Không thấy nút Phản hồi');
    return false;
  }

  replyBtn.click();
  await new Promise(r => setTimeout(r, 500));
  return true;
}

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

async function fillAndSendReplyIn(commentEl, replyText) {
  const found = await waitForReplyBoxIn(commentEl, 6000);
  if (!found) {
    logToSidebar('Không tìm thấy input hoặc nút gửi');
    return false;
  }

  const { textarea, sendBtn } = found;
  textarea.focus();
  textarea.value = replyText;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  await new Promise(r => setTimeout(r, 800));

  if (sendBtn.getAttribute('aria-disabled') === 'true' || sendBtn.disabled) {
    logToSidebar('Nút gửi bị disabled');
    return false;
  }

  sendBtn.click();
  logToSidebar('Đã gửi phản hồi');
  await new Promise(r => setTimeout(r, 1200));
  return true;
}

async function autoApplyReply(replyText) {
  if (!currentCommentEl) return;
  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  if (ok) markAsReplied(currentCommentEl);
  else markAsFailed(currentCommentEl);
  chrome.runtime.sendMessage({ action: 'hidePreview' });
  moveToNextComment();
}

async function applyReplyToCurrent(replyText) {
  if (!currentCommentEl) return;
  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  if (ok) markAsReplied(currentCommentEl);
  else markAsFailed(currentCommentEl);
  chrome.runtime.sendMessage({ action: 'hidePreview' });
  moveToNextComment();
}

async function regenerateCurrentReply() {
  if (!currentCommentEl) return;
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  if (!commentText) return;
  
  chrome.runtime.sendMessage({ action: 'setLoading', loading: true });
  const newReply = await generateReply(commentText);
  chrome.runtime.sendMessage({ action: 'setLoading', loading: false });
  
  if (newReply) {
    chrome.runtime.sendMessage({ 
      action: 'showPreview', 
      reply: newReply,
      comment: commentText
    });
  }
}

// ĐÁNH DẤU ĐÃ TRẢ LỜI
function markAsReplied(el) {
  const mainComment = el.querySelector('ytcp-comment#comment');
  if (mainComment) mainComment.classList.add('auto-replied');
  el.style.borderLeft = '4px solid #0f0';
}

// ĐÁNH DẤU ĐÃ SKIP (MỚI)
function markAsSkipped(el) {
  const mainComment = el.querySelector('ytcp-comment#comment');
  if (mainComment) mainComment.classList.add('auto-skipped');
  el.style.borderLeft = '4px solid #ffa500'; // Màu cam để phân biệt
}

// ĐÁNH DẤU LỖI
function markAsFailed(el) {
  el.style.borderLeft = '4px solid #f00';
}

function moveToNextComment() {
  currentCommentEl = null;
  window.scrollBy(0, 200);
  setTimeout(() => {
    if (isRunning) processNextComment();
  }, 1500);
}

async function generateReply(commentText, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // LẤY LỊCH SỬ CHAT
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['customPrompt', 'chatHistory'], resolve);
      });

      const rawPrompt = stored.customPrompt || `Bạn là chủ kênh YouTube. Hãy trả lời bình luận này một cách thân thiện, tích cực, ngắn gọn bằng tiếng Việt (hoặc tiếng Anh nếu comment bằng tiếng Anh). Chỉ trả lời nội dung, không giải thích.\n\nBình luận: "{{COMMENT}}"`;

      // TẠO PROMPT CÓ NGỮ CẢNH TỪ CHAT
      let contents = [];

      // Thêm lịch sử chat (nếu có)
      if (stored.chatHistory && Array.isArray(stored.chatHistory)) {
        contents = stored.chatHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.parts[0].text }]
        }));
      }

      // Thêm prompt chính
      const finalPrompt = rawPrompt.replace(/{{COMMENT}}/g, commentText);
      contents.push({ role: 'user', parts: [{ text: finalPrompt }] });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      const data = await response.json();
      
      if (response.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        logToSidebar(`Rate limit. Retry ${i + 1}/${retries} sau ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else if (data.error) {
        throw new Error(data.error.message);
      }
    } catch (error) {
      logToSidebar(`Error (${i + 1}/${retries}): ${error.message}`);
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return null;
}