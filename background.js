chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FORM_DATA") {
    chrome.storage.local.set({ tempFormData: message.payload });
  }
});
