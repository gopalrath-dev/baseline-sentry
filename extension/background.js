chrome.runtime.onInstalled.addListener(() => {
  console.info("BaselineSentry installed. Analysis stays local unless a future opt-in API is enabled.");
});

