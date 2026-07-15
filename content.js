/**
 * ============================================================================
 * Pinify — Content Script v1.2
 * Single floating FAB that follows the cursor to any Pinterest image.
 * No DOM injection into pin cards — avoids all Pinterest DOM fragility.
 * ============================================================================
 */

(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const PINIMG            = 'pinimg.com';
  const FEEDBACK_MS       = 2000;
  const FAB_SIZE          = 42;
  const FAB_OFFSET        = 10;
  const FAB_TOP_OFFSET    = 56;  // Offset below Pinterest's Save button
  const HIDE_DELAY        = 200;

  // SVG icons
  const ICON_DOWNLOAD = `<svg class="pinify-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const ICON_CHECK    = `<svg class="pinify-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const ICON_RETRY    = `<svg class="pinify-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
  const ICON_SPINNER  = `<svg class="pinify-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/></svg>`;

  // ── State ──────────────────────────────────────────────────────────────────
  let altKeyHeld    = false;
  let currentImg    = null;   // The img element the FAB is anchored to
  let hideTimer     = null;
  let isDownloading = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function isPinImg(src) {
    return src && src.includes(PINIMG);
  }

  function resolveHDUrl(src) {
    if (!src || !isPinImg(src)) return null;
    try {
      const url = new URL(src);
      url.pathname = url.pathname.replace(
        /\/(75x75[^/]*|170x|236x|474x|564x|736x|originals)\//,
        '/originals/'
      );
      return url.href;
    } catch {
      return src.replace(
        /\/(75x75[^/]*|170x|236x|474x|564x|736x)\//,
        '/originals/'
      );
    }
  }

  function getBestSrc(img) {
    if (img.srcset) {
      const best = img.srcset
        .split(',')
        .map(s => s.trim().split(/\s+/))
        .filter(p => isPinImg(p[0]))
        .map(p => ({ url: p[0], w: parseInt(p[1]) || 0 }))
        .sort((a, b) => b.w - a.w);
      if (best.length) return best[0].url;
    }
    return img.currentSrc || img.src;
  }

  function deriveFilename(url) {
    try {
      const last = new URL(url).pathname.split('/').pop();
      if (last && /\.\w{3,4}$/.test(last)) return `pinify-${last}`;
    } catch {}
    return `pinify-${Date.now()}.jpg`;
  }

  /**
   * Finds the nearest pinimg <img> from an event target,
   * walking up the DOM in case the user hovers a wrapper div.
   */
  function findPinImgFromTarget(target) {
    // Direct hit: target is the image
    if (target.tagName === 'IMG' && isPinImg(target.currentSrc || target.src)) {
      const r = target.getBoundingClientRect();
      if (r.width >= 60 && r.height >= 60) return target;
    }

    // Walk up a few levels and check children for a pinimg image
    let el = target;
    for (let i = 0; i < 5 && el; i++) {
      const imgs = el.querySelectorAll?.('img');
      if (imgs) {
        for (const img of imgs) {
          const src = img.currentSrc || img.src || '';
          if (isPinImg(src)) {
            const r = img.getBoundingClientRect();
            if (r.width >= 60 && r.height >= 60) return img;
          }
        }
      }
      el = el.parentElement;
    }

    return null;
  }

  // ── Create the Floating FAB (once, appended to <body>) ─────────────────────
  const fab = document.createElement('button');
  fab.className = 'pinify-fab';
  fab.setAttribute('aria-label', 'Download high-resolution image');
  fab.setAttribute('title', '');
  fab.innerHTML = ICON_DOWNLOAD;
  fab.style.position = 'fixed';
  fab.style.display = 'none';
  fab.style.pointerEvents = 'auto';

  function appendFAB() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', appendFAB);
      return;
    }
    document.body.appendChild(fab);
  }
  appendFAB();

  // ── Position the FAB over an image ─────────────────────────────────────────
  function positionFAB(rect) {
    // Bottom-left corner — avoids Save (top-right) and Share (bottom-right)
    fab.style.top  = (rect.bottom - FAB_SIZE - 12) + 'px';
    fab.style.left = (rect.left + 12) + 'px';
  }

  function showFAB(img) {
    clearTimeout(hideTimer);
    currentImg = img;

    const rect = img.getBoundingClientRect();

    // Position at bottom-right of the image (clear of Pinterest's Save button)
    positionFAB(rect);
    fab.style.display = 'flex';

    // Trigger the visible animation
    requestAnimationFrame(() => {
      fab.classList.add('pinify-fab--visible');
    });
  }

  function hideFAB() {
    if (isDownloading) return; // Don't hide during download feedback
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      fab.classList.remove('pinify-fab--visible');
      // Wait for fade-out animation, then hide fully
      setTimeout(() => {
        if (!fab.classList.contains('pinify-fab--visible')) {
          fab.style.display = 'none';
          currentImg = null;
        }
      }, 300);
    }, HIDE_DELAY);
  }
  // ── Download via Background Service Worker ──────────────────────────────────
  // Background fetches image in extension context → data URL → chrome.downloads
  // This gives the strongest saveAs:false authority in both Chrome & Brave.

  async function downloadImage(img) {
    const src = getBestSrc(img);
    if (!isPinImg(src)) {
      setFeedback('error');
      return;
    }

    isDownloading = true;
    fab.classList.add('pinify-fab--loading');
    fab.innerHTML = ICON_SPINNER;

    const filename = deriveFilename(src).replace(/\.(xml|html|htm|txt)$/i, '.jpg');

    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'pinify:download', url: src, filename },
          (resp) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (resp?.success) resolve(resp);
            else reject(new Error(resp?.error || 'Download failed'));
          }
        );
      });
      setFeedback('success');
    } catch (err) {
      console.warn('[Pinify] Download error:', err.message);
      setFeedback('error');
    }
  }

  function setFeedback(state) {
    fab.classList.remove('pinify-fab--loading', 'pinify-fab--success', 'pinify-fab--error', 'pinify-fab--pulse');

    if (state === 'success') {
      fab.innerHTML = ICON_CHECK;
      fab.classList.add('pinify-fab--success', 'pinify-fab--pulse');
    } else {
      fab.innerHTML = ICON_RETRY;
      fab.classList.add('pinify-fab--error');
    }

    setTimeout(() => {
      fab.classList.remove('pinify-fab--success', 'pinify-fab--error', 'pinify-fab--pulse');
      fab.innerHTML = ICON_DOWNLOAD;
      isDownloading = false;
    }, FEEDBACK_MS);
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  // FAB click → download
  fab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (isDownloading || !currentImg) return;
    downloadImage(currentImg);
  }, { capture: true });

  // Keep FAB visible when hovering the FAB itself
  fab.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
  });

  fab.addEventListener('mouseleave', () => {
    hideFAB();
  });

  // Global mouseover — detect Pinterest images
  document.addEventListener('mouseover', (e) => {
    const img = findPinImgFromTarget(e.target);
    if (img) {
      showFAB(img);
    }
  }, { passive: true });

  // Global mouseout — hide FAB when leaving images
  document.addEventListener('mouseout', (e) => {
    // Only process if leaving an img or its container
    if (e.target.tagName === 'IMG' || e.target.contains?.(currentImg)) {
      // Check if we're moving to the FAB
      const related = e.relatedTarget;
      if (related === fab || fab.contains(related)) return;
      hideFAB();
    }
  }, { passive: true });

  // Re-position FAB on scroll (image positions change)
  window.addEventListener('scroll', () => {
    if (currentImg && fab.style.display !== 'none') {
      const rect = currentImg.getBoundingClientRect();
      // Hide if image scrolled out of view
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        fab.style.display = 'none';
        fab.classList.remove('pinify-fab--visible');
        currentImg = null;
      } else {
        positionFAB(rect);
      }
    }
  }, { passive: true });

  // ── Alt Key Tracking ───────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && !altKeyHeld) {
      altKeyHeld = true;
      document.body.classList.add('pinify-alt-active');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      altKeyHeld = false;
      document.body.classList.remove('pinify-alt-active');
    }
  });

  // Alt+Click on any image → instant download via background
  document.addEventListener('click', (e) => {
    if (!altKeyHeld) return;

    const img = findPinImgFromTarget(e.target);
    if (!img) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const src = getBestSrc(img);
    if (!isPinImg(src)) return;

    const filename = deriveFilename(src).replace(/\.(xml|html|htm|txt)$/i, '.jpg');
    chrome.runtime.sendMessage({ action: 'pinify:download', url: src, filename });
  }, true);

  // ── Log ────────────────────────────────────────────────────────────────────
  console.log(
    '%c✦ Pinify %c1.2.0 %c— Active on ' + location.hostname,
    'color:#7c83ff;font-weight:bold;font-size:13px',
    'color:#888;font-size:11px',
    'color:#4ade80;font-size:11px'
  );
})();
