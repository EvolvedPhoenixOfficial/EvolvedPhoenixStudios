# 🌐 EvolvedPhoenix Studios Website

![Status: Live](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge)
![Not Open Source](https://img.shields.io/badge/Not-Open%20Source-black?style=for-the-badge)

This repository contains the source code for the **official website of EvolvedPhoenix Studios**.  
It showcases our projects, news, and updates in one central place.

🔗 [Visit the live site](https://www.evolvedphoenixstudios.com)

---

## 📖 About

The EvolvedPhoenix Studios website is the hub for everything related to our games, updates, and announcements.  
It is designed and maintained as part of our official online presence.

This repository is made public **for transparency, reference, and version tracking**, **not for reuse**.

---

## 🚫 License & Usage

⚠️ **Important Notice**:  
All code, design, artwork, and content in this repository are **copyright © EvolvedPhoenix Studios**.  

- ❌ You may **not** copy, redistribute, or reuse this repository (or parts of it) for your own projects.  
- ❌ You may **not** republish this content elsewhere, in whole or in part.  
- ✔️ You may **view** the source code for learning purposes.  
- ✔️ You may **reference** design/implementation ideas **with attribution**, but direct reuse is prohibited.  

If you are interested in collaboration or licensing, please contact us directly.

---

## 🛠️ Tech Stack

- **HTML5, CSS3, JavaScript**  
- **TailwindCSS** for styling  
- **Static Hosting** (GitHub Pages / external server)  

---

## 📬 Contact

- 🌍 Website: [https://www.evolvedphoenixstudios.com](https://www.evolvedphoenixstudios.com)  
- 💬 Discord: [Join our community](https://discord.gg/EkUYKmW)  
- 🐦 Twitter/X: [@EvolvedPhoenix](https://twitter.com/)  

---

## ⚖️ Legal

© EvolvedPhoenix Studios. All rights reserved.  
This repository is provided publicly for transparency. **It is not open source.**

---

## 🧪 Local Development

You can run the static site together with a simple API server for local testing.

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm (bundled with Node.js)

### Installation

```bash
npm install
```

### Running the server

```bash
npm start
```

The site and API will be available at [http://localhost:3000](http://localhost:3000).

### Test credentials

| Username | Password |
| -------- | -------- |
| admin    | password |

You can override the defaults by creating a `.env` file at the project root:

```ini
LOGIN_CREDENTIALS=admin:password,anotherUser:anotherSecret
LOGIN_REDIRECT_URL=/dashboard.html
PORT=3000
```

If you change the port or host, update your browser URL accordingly.
