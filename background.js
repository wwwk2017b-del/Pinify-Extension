/**
 * Pinify — Background Service Worker v1.4
 * Fetches images inside the extension context and downloads as data URL.
 * saveAs:false from extension background has strongest override in Brave.
 */

const SIZES = ['originals', '736x', '564x', '474x'];
const SIZE_PATTERN = /\/(75x75[^/]*|170x|236x|474x|564x|736x|originals)\//;

function getCandidates(url) {
  const urls = [];
  for (const size of SIZES) {
    const c = url.replace(SIZE_PATTERN, `/${size}/`);
    if (!urls.includes(c)) urls.push(c);
  }
  if (!urls.includes(url)) urls.push(url);
  return urls;
}

/**
 * Convert ArrayBuffer to base64 string (service-worker safe, chunked).
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Fetch image in extension context, convert to data URL, download locally.
 * This avoids CORS issues and gives strongest saveAs:false authority.
 */
async function fetchAndDownload(imageUrl, filename) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error('Not an image');

  const buffer = await resp.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mimeType = contentType.split(';')[0].trim();
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

/**
 * Try each resolution candidate until one succeeds.
 */
async function downloadWithFallback(url, filename) {
  const candidates = getCandidates(url);

  for (const candidate of candidates) {
    try {
      const downloadId = await fetchAndDownload(candidate, filename);
      return { success: true, downloadId };
    } catch (err) {
      console.log(`[Pinify] Skipping ${candidate}: ${err.message}`);
    }
  }

  return { success: false, error: 'All resolutions failed' };
}

// ── Message Listener ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'pinify:download') return false;

  let filename = (message.filename || `pinify-${Date.now()}.jpg`)
    .replace(/\.(xml|html|htm|txt)$/i, '.jpg');

  downloadWithFallback(message.url, filename).then(sendResponse);
  return true; // async
});
