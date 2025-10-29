const MOVIE_PATH_REGEX = /^\/title\/tt\d+/;

function extractMovieTitle() {
  const titleSelectors = [
    'h1[data-testid="hero-title-block__title"]',
    '.sc-b73cd867-0.eKrKux', // legacy imdb selector fallback
    'section h1'
  ];

  for (const selector of titleSelectors) {
    const node = document.querySelector(selector);
    if (node?.textContent?.trim()) {
      return node.textContent.trim();
    }
  }

  return null;
}

function extractYear() {
  const yearNode = document.querySelector(
    '[data-testid="hero-title-block__metadata"] li:first-child a'
  );

  if (yearNode?.textContent?.trim()) {
    const yearMatch = yearNode.textContent.trim().match(/\d{4}/);
    return yearMatch ? yearMatch[0] : null;
  }

  return null;
}

function detectIfTvContent() {
  const badgeNode = document.querySelector(
    '[data-testid="hero-title-block__metadata"] li span'
  );

  if (!badgeNode?.textContent) {
    return false;
  }

  return /(TV Series|TV Episode|TV Mini Series|TV Special)/i.test(
    badgeNode.textContent
  );
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== "GET_IMDB_MOVIE") {
    return;
  }

  const { pathname } = window.location;
  if (!MOVIE_PATH_REGEX.test(pathname)) {
    sendResponse({
      success: false,
      reason: "Not on an IMDB movie page."
    });
    return;
  }

  if (detectIfTvContent()) {
    sendResponse({
      success: false,
      reason: "Detected TV content. This extension only supports movies."
    });
    return;
  }

  const title = extractMovieTitle();
  const year = extractYear();
  const imdbMatch = window.location.href.match(/\/title\/(tt\d+)/);
  const imdbId = imdbMatch ? imdbMatch[1] : null;

  if (!title || !imdbId) {
    sendResponse({
      success: false,
      reason: "Could not read movie details from the page."
    });
    return;
  }

  sendResponse({
    success: true,
    movie: {
      title,
      year,
      imdbId
    }
  });
});
