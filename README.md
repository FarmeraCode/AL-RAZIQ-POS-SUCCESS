# Al Raziq POS — LAN & Localhost Deployment

This repository contains the working code for Al Raziq POS, optimized for Localhost and LAN server deployment.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

## Installation

1. Clone or download this repository.
2. Open a terminal in the project root.
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the POS

To start the POS server and UI for both Localhost and LAN access:

### 1. Production Mode (Recommended)
If you have already built the project (or want to build and start now):
```bash
npm run build:prod
```
This will build the frontend and start the unified server on port **7000**.

### 2. Development Mode
For active development with hot-reloading:
```bash
npm run dev
```

## Accessing the POS

Once started, the POS is accessible at:
- **Local:** `http://localhost:7000`
- **LAN:** `http://<your-ip-address>:7000` (e.g., `http://192.168.1.10:7000`)

The server also supports **UDP Discovery** for mobile apps to find the server automatically.

## Deployment Notes
- All `.exe` and `.bat` files have been removed to keep the repository clean and focused on the core logic.
- The server automatically handles the SQLite database in the user's home directory (`~/.al-raziq-pos`).
