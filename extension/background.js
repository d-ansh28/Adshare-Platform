const DEFAULT_API = 'http://localhost:3000';
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['apiBase']);
  if (!data.apiBase) await chrome.storage.local.set({ apiBase: DEFAULT_API });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'ADSHARE_API') return;
  (async () => {
    const { apiBase = DEFAULT_API, token } = await chrome.storage.local.get(['apiBase', 'token']);
    try {
      const response = await fetch(`${apiBase.replace(/\/$/, '')}${message.path}`, {
        method: message.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: message.body ? JSON.stringify(message.body) : undefined
      });
      const data = await response.json().catch(() => ({}));
      sendResponse({ ok: response.ok, status: response.status, data });
    } catch (error) { sendResponse({ ok: false, error: error.message }); }
  })();
  return true;
});
