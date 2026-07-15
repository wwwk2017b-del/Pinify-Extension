# ✦ Pinify — Pinterest HD Downloader

<div align="center">

**Instantly download high-resolution images from Pinterest with a single click.**

*A sleek Chrome & Brave extension with a glassmorphic floating download button.*

![Chrome](https://img.shields.io/badge/Chrome-Supported-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)
![Brave](https://img.shields.io/badge/Brave-Supported-FB542B?style=for-the-badge&logo=brave&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0F9D58?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-A855F7?style=for-the-badge)

</div>

---

## ⚡ Features

- 🖱️ **One-Click Download** — Hover over any pin, click the floating button, done.
- 🔍 **Auto HD Resolution** — Automatically fetches the highest available quality (`originals`).
- 🎨 **Glassmorphic UI** — Frosted glass button with a subtle glowing aura and micro-animations.
- ⌨️ **Alt+Click Shortcut** — Hold `Alt` (or `Option` on Mac) and click any image to download instantly.
- 📥 **Silent Download** — Saves directly to your Downloads folder. No popups, no new tabs.
- 🌍 **All Pinterest Domains** — Works on `pinterest.com`, `in.pinterest.com`, `pinterest.co.uk`, and 20+ regional domains.
- 🔄 **Smart Fallback** — If the original resolution isn't available, automatically tries the next best quality.
- ♿ **Accessible** — Keyboard shortcuts, ARIA labels, and `prefers-reduced-motion` support.

---

## 📦 Installation

Since this is an unpacked extension (not on the Chrome Web Store), you'll install it manually. It takes 30 seconds:

### Step 1: Download the Code

```bash
git clone https://github.com/YOUR_USERNAME/pinify.git
```

Or click the green **Code** button above → **Download ZIP** → extract the folder.

### Step 2: Load in Chrome / Brave

1. Open your browser and go to:
   - **Chrome:** `chrome://extensions/`
   - **Brave:** `brave://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `pinify` folder you just downloaded
5. ✅ You'll see **Pinify — Pinterest HD Downloader** appear in your extensions list

### Step 3: Use It

1. Go to [pinterest.com](https://www.pinterest.com) (or any regional Pinterest site)
2. Hover over any pin image
3. A glowing download button appears at the **bottom-left** of the image
4. **Click it** — the image downloads in HD instantly!

> **💡 Pro Tip:** Hold `Alt` and click any Pinterest image to download it instantly without using the button.

---

## 🎨 Design

The floating download button uses an **Antigravity-inspired glassmorphic** design:

| Property | Value |
|----------|-------|
| Background | Frosted glass with `backdrop-filter: blur(18px)` |
| Glow | Soft indigo aura (`rgba(124, 131, 255)`) |
| Border Radius | 16px (heavily rounded) |
| Hover Effect | Gentle scale up to 112% with spring easing |
| Success State | Green glow + checkmark + pulse animation |
| Error State | Red glow + retry icon |

---

## 🗂️ Project Structure

```
pinify/
├── manifest.json     # Extension config (permissions, scripts, domains)
├── content.js        # Injected into Pinterest — detects images, shows FAB
├── style.css         # Glassmorphic button styles and animations
└── background.js     # Service worker — fetches images and saves to disk
```

---

## 🔧 How It Works

```
User hovers pin image
        ↓
content.js detects <img> with pinimg.com src
        ↓
Floating download button appears (bottom-left)
        ↓
User clicks the button
        ↓
content.js → sends message → background.js
        ↓
background.js fetches image (tries originals → 736x → 564x → 474x)
        ↓
Converts to data URL → chrome.downloads.download()
        ↓
Image saved to Downloads folder ✅
```

### The HD Resolution Trick

Pinterest stores images at multiple resolutions on their CDN:

```
https://i.pinimg.com/236x/ab/cd/ef/image.jpg     ← Low res
https://i.pinimg.com/736x/ab/cd/ef/image.jpg     ← High res
https://i.pinimg.com/originals/ab/cd/ef/image.jpg ← Full HD ✨
```

Pinify swaps the size segment (`236x`, `474x`, etc.) with `originals` to get the highest quality version.

---

## ⚙️ Brave Browser Setup

For **automatic downloads** in Brave (no "Save As" dialog):

1. Go to `brave://settings/downloads`
2. Turn **OFF** → "Ask where to save each file before downloading"

The extension uses a data URL download method that works best when this setting is off.

---

## 🛠️ Development

Want to modify the extension? Here's how:

1. Clone the repo and make your changes
2. Go to `chrome://extensions/` → click the ↻ reload button on Pinify
3. Hard-refresh Pinterest (`Ctrl + Shift + R`) to load the updated scripts

No build step required — it's pure JavaScript, CSS, and JSON.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- 🐛 Report bugs via [Issues](https://github.com/YOUR_USERNAME/pinify/issues)
- 💡 Suggest features
- 🔀 Submit pull requests

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">

**Made with ✦ by [YOUR_NAME]**

*If this helped you, consider giving it a ⭐!*

</div>
