// Bật hành vi: bấm icon -> mở side panel (dùng default_path trong manifest)
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// (Tùy chọn) Nếu bạn muốn đảm bảo panel mở được ngay cả khi behavior bị tắt,
// dùng thêm handler dưới đây.
// Nó enable panel cho tab hiện tại và mở panel ngay lập tức.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidebar.html',
      enabled: true
    });
    // Một số bản Chrome hỗ trợ open(), một số chỉ cần behavior ở trên là đủ.
    if (chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.warn('sidePanel open fallback:', e);
  }
});
