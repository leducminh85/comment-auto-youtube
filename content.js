// --- START OF FILE content.js ---

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
    if (currentCommentEl) {
      markAsSkipped(currentCommentEl);
    }
    hideReplyBox();
    currentCommentEl = null;
    // No longer sends hidePreview
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

function getUnrepliedComments() {
  const allThreads = Array.from(document.querySelectorAll('ytcp-comment-thread'));
  return allThreads.filter(thread => {
    const mainComment = thread.querySelector('ytcp-comment#comment');
    const hasRepliesSection = thread.querySelector('ytcp-comment-replies');
    const repliedClass = mainComment?.classList.contains('auto-replied');
    const skippedClass = mainComment?.classList.contains('auto-skipped');

    if (repliedClass || skippedClass) return false;
    if (hasRepliesSection && hasRepliesSection.querySelector('ytcp-comment')) return false;
    return true;
  });
}

async function processNextComment() {
  if (!isRunning) return;

  const unreplied = getUnrepliedComments();
  if (unreplied.length === 0) {
    logToSidebar('Không tìm thấy comment, đang cuộn...');
    window.scrollBy(0, SCROLL_STEP);
    setTimeout(processNextComment, 3000); // Try again after scroll
    return;
  }

  currentCommentEl = unreplied[0];
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  if (!commentText) {
      moveToNextComment(); // Skip empty comments
      return;
  }
  
  // 1. Tell sidebar we are loading for this specific comment
  chrome.runtime.sendMessage({ 
    action: 'showPreviewLoading', 
    comment: commentText
  });

  const reply = await generateReply(commentText);
  if (!reply) {
    markAsFailed(currentCommentEl);
    // Don't hide preview, just move on. Sidebar will go back to 'waiting' state
    // when the next comment is found.
    moveToNextComment();
    return;
  }
  
  // 2. Send the actual reply to fill the preview box
  chrome.runtime.sendMessage({ 
    action: 'showPreview', 
    reply: reply,
    comment: commentText
  });
  
  await openReplyBox(currentCommentEl);

  if (currentMode === 'continuous') {
    setTimeout(() => {
      // Check if we are still on the same comment before auto-applying
      if (currentCommentEl === unreplied[0]) {
        autoApplyReply(reply);
      }
    }, 2000); // Increased delay slightly
  }
}

async function openReplyBox(commentEl) { /* ... no changes ... */ }
async function waitForReplyBoxIn(commentEl, timeout = 6000) { /* ... no changes ... */ }
async function fillAndSendReplyIn(commentEl, replyText) { /* ... no changes ... */ }
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

// --- UPDATED ACTION HANDLERS ---
// They no longer send 'hidePreview'

async function autoApplyReply(replyText) {
  if (!currentCommentEl) return;
  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  if (ok) markAsReplied(currentCommentEl);
  else markAsFailed(currentCommentEl);
  moveToNextComment();
}

async function applyReplyToCurrent(replyText) {
  if (!currentCommentEl) return;
  
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  const ok = await fillAndSendReplyIn(currentCommentEl, replyText);
  
  if (ok) {
    markAsReplied(currentCommentEl);
    if (commentText) {
      chrome.runtime.sendMessage({
        action: 'addToChatHistory',
        comment: commentText,
        reply: replyText
      });
    }
  } else {
    markAsFailed(currentCommentEl);
  }
  moveToNextComment();
}

async function regenerateCurrentReply() {
  if (!currentCommentEl) return;
  const commentText = currentCommentEl.querySelector('#content-text')?.innerText.trim();
  if (!commentText) return;
  
  const newReply = await generateReply(commentText);
  
  if (newReply) {
    chrome.runtime.sendMessage({ 
      action: 'showPreview', 
      reply: newReply,
      comment: commentText
    });
  } else {
    // If regen fails, tell sidebar to go back to a waiting state for a new comment
    logToSidebar('Regeneration failed. Moving to next comment.');
    moveToNextComment();
  }
}

function markAsReplied(el) { /* ... no changes ... */ }
function markAsSkipped(el) { /* ... no changes ... */ }
function markAsFailed(el) { /* ... no changes ... */ }
function markAsReplied(el) {
  const mainComment = el.querySelector('ytcp-comment#comment');
  if (mainComment) mainComment.classList.add('auto-replied');
  el.style.borderLeft = '4px solid #0f0';
}
function markAsSkipped(el) {
  const mainComment = el.querySelector('ytcp-comment#comment');
  if (mainComment) mainComment.classList.add('auto-skipped');
  el.style.borderLeft = '4px solid #ffa500';
}
function markAsFailed(el) {
  el.style.borderLeft = '4px solid #f00';
}


function moveToNextComment() {
  currentCommentEl = null;
  // Use a shorter timeout to make transition feel faster
  setTimeout(() => {
    if (isRunning) processNextComment();
  }, 500); 
}

// --- UNCHANGED FUNCTIONS ---
function getCurrentChannelId() { /* ... no changes ... */ }
async function generateReply(commentText, retries = 3) { /* ... no changes ... */ }
function getCurrentChannelId() {
  try {
    const url = location.href;
    const match = url.match(/studio\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch (error) {
    logToSidebar("Error getting channel ID: " + error.message);
    return null;
  }
}
async function generateReply(commentText, retries = 3) {
  const channelId = getCurrentChannelId();
  if (!channelId) {
    logToSidebar("No channel ID found. Falling back to empty history for chatbot mode.");
  }

  for (let i = 0; i < retries; i++) {
    try {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['customPrompt', 'allChatHistories', 'contextMode'], resolve);
      });
      
      const contextMode = stored.contextMode || 'prompt';
      let contents = [];

      if (contextMode === 'chatbot') {
        logToSidebar('Context: Chat History');
        const allHistories = stored.allChatHistories || {};
        const chatHistory = allHistories[channelId] || [];
        
        contents = chatHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.parts[0].text }]
        }));
        
        const finalPrompt = `Based on the entire context of the conversation above, please reply to this YouTube comment briefly and appropriately:\n\nComment: "${commentText}"\n\nNote: Only the reply text is returned, no further explanation.`;
        contents.push({ role: 'user', parts: [{ text: finalPrompt }] });

      } else {
        logToSidebar('Context: Custom Prompt');
        const rawPrompt = stored.customPrompt || `You are a YouTube channel owner. Please reply to this comment in a friendly, positive, and concise manner in Vietnamese (or English if commenting in English). Only reply to the content, no explanation.\n\nComment: "{{COMMENT}}"`;
        const finalPrompt = rawPrompt.replace(/{{COMMENT}}/g, commentText);
        contents.push({ role: 'user', parts: [{ text: finalPrompt }] });
      }

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
// --- END OF FILE content.js ---