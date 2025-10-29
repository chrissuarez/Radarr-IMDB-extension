chrome.runtime.onInstalled.addListener(() => {
  // Ensure chrome.storage has the shape we expect without overwriting user data.
  chrome.storage.local.get(
    ["radarrUrl", "radarrApiKey", "radarrRootFolder", "qualityProfiles"],
    (stored) => {
      const defaults = {};

      if (!Array.isArray(stored.qualityProfiles)) {
        defaults.qualityProfiles = [];
      }

      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    }
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "RADARR_NOTIFY") {
    return;
  }

  const { title, message: body, isError } = message;
  const notificationOptions = {
    type: "basic",
    title: title ?? (isError ? "Radarr Error" : "Radarr"),
    message: body ?? "",
    iconUrl: isError ? "icons/icon48.png" : "icons/icon128.png"
  };

  chrome.notifications.create("", notificationOptions);
});
