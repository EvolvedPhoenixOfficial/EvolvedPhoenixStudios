# 🌐 Extynct Studios Website

![Status: Live](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge)
![Not Open Source](https://img.shields.io/badge/Not-Open%20Source-black?style=for-the-badge)

This repository contains the source code for the **official website of Extynct Studios**.
It showcases our projects, news, and updates in one central place.

🔗 [Visit the live site](https://www.extynctstudios.com)

---

## 📖 About

The Extynct Studios website is the hub for everything related to our games, updates, and announcements.
It is designed and maintained as part of our official online presence.

This repository is made public **for transparency, reference, and version tracking**, **not for reuse**.

---

## 🚫 License & Usage

⚠️ **Important Notice**:  
All code, design, artwork, and content in this repository are **copyright © Extynct Studios**.

- ❌ You may **not** copy, redistribute, or reuse this repository (or parts of it) for your own projects.  
- ❌ You may **not** republish this content elsewhere, in whole or in part.  
- ✔️ You may **view** the source code for learning purposes.  
- ✔️ You may **reference** design/implementation ideas **with attribution**, but direct reuse is prohibited.  

If you are interested in collaboration or licensing, please contact us directly.

---

## 🛠️ Tech Stack

- **HTML5, CSS3, JavaScript**  
- **TailwindCSS** inspired utility styles
- **Static Hosting** (GitHub Pages / external server)
- **GitHub REST API** calls from the browser to persist forum data

---

## 🧪 Local development & GitHub persistence

The site runs entirely on static hosting. Forum posts, uploads, and account records are written straight into this repository through the GitHub REST API. To test the workflow locally or on GitHub Pages:

1. [Create a GitHub personal access token](https://github.com/settings/tokens) with **repo** scope.
2. Visit the `/account/` page, open the **Connect to GitHub** card, and enter the repository owner, repository name, branch (defaults to `main`), and your token.
3. Create an account and sign in. The credentials are hashed in the browser, then appended to `data/accounts.json` via the GitHub API.
4. Head to `/forums/` while signed in to publish posts. Text content is saved into `data/posts.json`, and any uploads are committed under `uploads/forum/` with unique filenames.

Tokens and active-account details live in the browser's local storage. If storage is blocked (e.g., incognito with hardened privacy), you will need to re-enter settings whenever you refresh the page.

---

## 📬 Contact

- 🌍 Website: [https://www.extynctstudios.com](https://www.extynctstudios.com)
- 💬 Discord: [Join our community](https://discord.gg/EkUYKmW)  
- 🐦 Twitter/X: [@ExtynctStudios](https://twitter.com/ExtynctStudios)

---

## ⚖️ Legal

© Extynct Studios. All rights reserved.
This repository is provided publicly for transparency. **It is not open source.**
