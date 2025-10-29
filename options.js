const form = document.getElementById("optionsForm");
const radarrUrlInput = document.getElementById("radarrUrl");
const radarrApiKeyInput = document.getElementById("radarrApiKey");
const radarrRootFolderInput = document.getElementById("radarrRootFolder");
const qualityProfilesTextarea = document.getElementById("qualityProfiles");
const defaultQualityProfileSelect = document.getElementById("defaultQualityProfile");
const statusEl = document.getElementById("status");

function setStatus(message, type = "neutral") {
  statusEl.textContent = message;
  statusEl.className = type === "success" ? "success" : type === "error" ? "error" : "";
}

function parseProfiles(raw) {
  if (!raw.trim()) {
    return [];
  }

  const lines = raw.split(/\r?\n/);
  const profiles = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const [name, id] = line.split(":").map((segment) => segment.trim());
    if (!name || !id) {
      throw new Error(`Could not parse "${line}". Expected format "Name:ID".`);
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Profile ID must be numeric. Problem near "${line}".`);
    }
    profiles.push({ name, id: numericId });
  }

  return profiles;
}

function profilesToTextareaValue(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return "";
  }
  return profiles.map((profile) => `${profile.name}:${profile.id}`).join("\n");
}

function populateDefaultProfileSelect(profiles, selectedId) {
  defaultQualityProfileSelect.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None";
  defaultQualityProfileSelect.appendChild(noneOption);

  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = String(profile.id);
    option.textContent = profile.name;
    if (selectedId && String(profile.id) === String(selectedId)) {
      option.selected = true;
    }
    defaultQualityProfileSelect.appendChild(option);
  });
}

function getStoredSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["radarrUrl", "radarrApiKey", "radarrRootFolder", "qualityProfiles", "defaultQualityProfileId"],
      (items) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(items);
      }
    );
  });
}

function saveSettings(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function restoreOptions() {
  try {
    const stored = await getStoredSettings();
    radarrUrlInput.value = stored.radarrUrl ?? "";
    radarrApiKeyInput.value = stored.radarrApiKey ?? "";
    radarrRootFolderInput.value = stored.radarrRootFolder ?? "";
    qualityProfilesTextarea.value = profilesToTextareaValue(stored.qualityProfiles);
    populateDefaultProfileSelect(stored.qualityProfiles ?? [], stored.defaultQualityProfileId);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load settings. Check the console for more details.", "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving…");

  try {
    const radarrUrl = radarrUrlInput.value.trim();
    const radarrApiKey = radarrApiKeyInput.value.trim();
    const radarrRootFolder = radarrRootFolderInput.value.trim();
    const parsedProfiles = parseProfiles(qualityProfilesTextarea.value);
    const defaultQualityProfileId = defaultQualityProfileSelect.value
      ? Number(defaultQualityProfileSelect.value)
      : null;

    if (!radarrUrl || !radarrApiKey || !radarrRootFolder) {
      throw new Error("Radarr URL, API key, and root folder are all required.");
    }

    if (defaultQualityProfileId && !parsedProfiles.some((profile) => profile.id === defaultQualityProfileId)) {
      throw new Error("Default quality profile must match one of the listed profiles.");
    }

    await saveSettings({
      radarrUrl: radarrUrl.replace(/\/+$/, ""),
      radarrApiKey,
      radarrRootFolder,
      qualityProfiles: parsedProfiles,
      defaultQualityProfileId
    });

    populateDefaultProfileSelect(parsedProfiles, defaultQualityProfileId);
    setStatus("Settings saved.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message ?? "Unable to save settings.", "error");
  }
});

document.addEventListener("DOMContentLoaded", restoreOptions);
