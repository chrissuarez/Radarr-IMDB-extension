const ACTIVE_IMDB_REGEX = /^https:\/\/www\.imdb\.com\/title\/tt\d+/i;

const messageEl = document.getElementById("message");
const movieDetailsEl = document.getElementById("movieDetails");
const movieTitleEl = document.getElementById("movieTitle");
const movieYearEl = document.getElementById("movieYear");
const qualitySelectEl = document.getElementById("qualityProfile");
const sendButtonEl = document.getElementById("sendButton");
const statusEl = document.getElementById("status");

let currentTabId = null;
let movieDetails = null;
let extensionConfig = null;

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = isError ? "error" : "";
}

function setStatus(text, type = "neutral") {
  statusEl.textContent = text;
  statusEl.className = type === "success" ? "success" : type === "error" ? "error" : "";
  statusEl.classList.toggle("hidden", !text);
}

function populateQualityProfiles(profiles, preselectId) {
  qualitySelectEl.innerHTML = "";
  profiles.forEach((profile) => {
    if (!profile || typeof profile.id === "undefined" || !profile.name) {
      return;
    }
    const option = document.createElement("option");
    option.value = String(profile.id);
    option.textContent = profile.name;
    if (preselectId && String(profile.id) === String(preselectId)) {
      option.selected = true;
    }
    qualitySelectEl.appendChild(option);
  });
}

function requestNotification(payload) {
  chrome.runtime.sendMessage({
    type: "RADARR_NOTIFY",
    ...payload
  });
}

function queryTabs(queryOptions) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryOptions, (tabs) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(tabs);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function getStoredConfig() {
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

async function initialise() {
  try {
    setMessage("Checking current tab…");
    sendButtonEl.disabled = true;

    const tabs = await queryTabs({ active: true, currentWindow: true });
    const [activeTab] = tabs;

    if (!activeTab || !ACTIVE_IMDB_REGEX.test(activeTab.url ?? "")) {
      setMessage("Open an IMDB movie page and try again.", true);
      return;
    }

    currentTabId = activeTab.id;

    const response = await sendMessageToTab(activeTab.id, { type: "GET_IMDB_MOVIE" });

    if (!response?.success) {
      setMessage(response?.reason ?? "Unable to read movie details.", true);
      return;
    }

    movieDetails = response.movie;
    movieTitleEl.textContent = movieDetails.title;
    movieYearEl.textContent = movieDetails.year ? `Year: ${movieDetails.year}` : "";

    extensionConfig = await getStoredConfig();

    const { radarrUrl, radarrApiKey, radarrRootFolder, qualityProfiles } = extensionConfig;

    if (!radarrUrl || !radarrApiKey || !radarrRootFolder) {
      setMessage("Set your Radarr URL, API key, and root folder in the extension options.", true);
      return;
    }

    if (!Array.isArray(qualityProfiles) || qualityProfiles.length === 0) {
      setMessage("Add at least one quality profile in the extension options.", true);
      return;
    }

    populateQualityProfiles(qualityProfiles, extensionConfig.defaultQualityProfileId);

    movieDetailsEl.classList.remove("hidden");
    setMessage("");
    sendButtonEl.disabled = false;
  } catch (error) {
    console.error(error);
    setMessage("Something went wrong. Please refresh the page and try again.", true);
  }
}

async function fetchMovieFromRadarr(radarrUrl, apiKey, imdbId) {
  const url = `${radarrUrl}/api/v3/movie/lookup/imdb?imdbId=${encodeURIComponent(imdbId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Radarr lookup failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error("Radarr did not return any movie data for this IMDB ID.");
  }

  return data[0];
}

async function addMovieToRadarr({ movie, profileId, config }) {
  const { radarrUrl, radarrApiKey, radarrRootFolder } = config;
  const lookupData = await fetchMovieFromRadarr(radarrUrl, radarrApiKey, movie.imdbId);

  const payload = {
    title: lookupData.title ?? movie.title,
    qualityProfileId: Number(profileId),
    titleSlug: lookupData.titleSlug,
    tmdbId: lookupData.tmdbId,
    year: Number(lookupData.year ?? movie.year) || undefined,
    rootFolderPath: radarrRootFolder,
    images: lookupData.images ?? [],
    monitored: true,
    minimumAvailability: "released",
    addOptions: {
      searchForMovie: true
    },
    imdbId: movie.imdbId
  };

  const response = await fetch(`${radarrUrl}/api/v3/movie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": radarrApiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Radarr responded with ${response.status}: ${errorText}`);
  }

  return response.json();
}

function normaliseRadarrUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

async function handleSendClick(event) {
  event.preventDefault();

  if (!movieDetails || !extensionConfig) {
    return;
  }

  const qualityProfileId = qualitySelectEl.value;
  if (!qualityProfileId) {
    setStatus("Select a quality profile first.", "error");
    return;
  }

  sendButtonEl.disabled = true;
  setStatus("Sending to Radarr…");

  try {
    const normalisedUrl = normaliseRadarrUrl(extensionConfig.radarrUrl);
    extensionConfig.radarrUrl = normalisedUrl;

    await addMovieToRadarr({
      movie: movieDetails,
      profileId: qualityProfileId,
      config: extensionConfig
    });

    setStatus("Movie successfully added to Radarr.", "success");
    requestNotification({
      title: "Radarr",
      message: `${movieDetails.title} added successfully.`,
      isError: false
    });
  } catch (error) {
    console.error(error);
    const message = error?.message ?? "Failed to add movie – check your API key or server connection.";
    setStatus(message, "error");
    requestNotification({
      title: "Radarr Error",
      message,
      isError: true
    });
    sendButtonEl.disabled = false;
    return;
  }

  sendButtonEl.disabled = false;
}

sendButtonEl.addEventListener("click", handleSendClick);

document.addEventListener("DOMContentLoaded", initialise);
