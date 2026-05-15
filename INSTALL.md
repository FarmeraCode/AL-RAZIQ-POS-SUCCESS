# 🖥️ Al Raziq POS — New Device Installation Guide

> **For shop owners, cashiers, and IT staff setting up on any Windows PC.**  
> No programming knowledge required. Follow each step in order.

---

## 📋 What You Need Before Starting

| Item | Details |
|---|---|
| The POS project folder | `al-raziq-pos-main` (USB drive or shared folder) |
| Internet connection | Only needed during first-time setup |
| Windows 10 or 11 | 64-bit recommended |
| ~500 MB free disk space | For Node.js + project |

---

## STEP 1 — Install Node.js (One-Time Only)

> Node.js is the engine that runs the POS. You only install this once per PC.

### 1.1 Download Node.js

1. Open any browser on the new PC
2. Go to: **https://nodejs.org**
3. Click the big green button that says **"LTS"** (Long Term Support)

   > ⚠️ **Important:** Make sure it says **v22** or higher (e.g., `v22.14.0`). Do NOT download v18 or v20.

4. The file will be named something like: `node-v22.14.0-x64.msi`

### 1.2 Install Node.js

1. Double-click the downloaded `.msi` file
2. Click **Next** → **Next** → **Next** (keep all default options)
3. When asked about **"Tools for Native Modules"** — ❌ **UNCHECK / SKIP this** — you don't need it
4. Click **Install**
5. When done, click **Finish**

### 1.3 Verify Installation

1. Press **Windows key + R**, type `cmd`, press Enter
2. Type this command and press Enter:
   ```
   node --version
   ```
3. You should see something like: `v22.14.0`  
   ✅ If you see a version number starting with `v22` — Node.js is installed correctly.

---

## STEP 2 — Copy the POS Folder to the New PC

> You only do this once. After this, the project lives on the new PC.

### Option A: USB Drive
1. Plug in your USB drive containing the `al-raziq-pos-main` folder
2. Copy the **entire** `al-raziq-pos-main` folder to the Desktop
3. The final path should be: `C:\Users\[YourName]\Desktop\al-raziq-pos-main\`

### Option B: Shared Network Folder / Google Drive / OneDrive
1. Download or copy `al-raziq-pos-main` to the Desktop

> ✅ **Tip:** You can skip copying `node_modules` folder if it exists — it will be recreated in Step 3.  
> This makes the transfer much faster (the folder is normally 300–500 MB smaller without it).

---

## STEP 3 — Install Project Dependencies (One-Time Only)

> This downloads the required libraries for the POS to run. Internet needed.

1. Open **File Explorer** and navigate to your `al-raziq-pos-main` folder on the Desktop
2. In the folder, click the **address bar** at the top (where it shows the path)
3. Type `cmd` and press **Enter** — a black Command Prompt window opens inside that folder
4. Type this command and press **Enter:**
   ```
   npm install
   ```
5. Wait for it to finish. You'll see lots of text scrolling — this is normal.
6. When done, you'll see a line like:
   ```
   added 450 packages in 30s
   ```
7. Now also run:
   ```
   npm install --prefix server
   ```
8. Wait for it to finish (usually much faster — only 3 packages).

> ✅ Both installs are done. You don't need internet after this step.

---

## STEP 4 — Create the Desktop Shortcut (One-Time Only)

> This creates the one-click icon on the Desktop so you never need to use a terminal again.

1. In the same Command Prompt window, type:
   ```
   powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
   ```
2. Press **Enter**
3. You should see:
   ```
   SUCCESS: Shortcut created on Desktop at C:\Users\...\Open Al Raziq POS.lnk
   ```
4. Close the Command Prompt window
5. Look on your Desktop — you'll see an icon called **"Open Al Raziq POS"** 🎉

---

## STEP 5 — Allow Firewall Access (For LAN/Multi-Device Use)

> This allows other devices (phones, tablets, cashier PCs) to connect to the POS over WiFi.  
> **Skip this step if you only use the POS on one single PC.**

1. Double-click **"Open Al Raziq POS"** icon on the Desktop to start the app
2. A **Windows Security Alert** popup may appear asking about firewall
3. Check both boxes: **"Private networks"** and **"Public networks"**
4. Click **"Allow access"**

> ✅ This only happens once. After this, LAN devices can connect automatically.

---

## STEP 6 — Launch the POS (Every Day Use)

> From now on, this is all you do every single day.

1. **Double-click** the **"Open Al Raziq POS"** icon on the Desktop
2. A terminal window opens (don't close it — it's running the server)
3. Your browser opens automatically showing the POS
4. The terminal will show LAN URLs like:
   ```
   [Al Raziq POS] LAN URLs: http://192.168.1.5:7000
   ```

### To connect other devices (phones/tablets/cashier PCs):
- Open a browser on the other device
- Type the LAN URL shown in the terminal (e.g., `http://192.168.1.5:7000`)
- The full POS loads on that device too — all data synced in real time ✅

---

## 🛑 How to Stop the POS

- Simply **close the terminal/black window**
- Or press **Ctrl + C** inside the terminal window

---

## ❓ Troubleshooting

### "node is not recognized as a command"
→ Node.js is not installed. Repeat **Step 1**.

### "npm install fails with errors about Python / gyp / MSVC"
→ This should NOT happen with the current version. If it does, contact IT — it means an old version of the project is being used.

### Browser shows blank white page
→ Wait 30–60 seconds after launching — Vite (the UI) takes time to start on first launch.

### Other devices can't connect on LAN
→ Firewall is blocking. Run this in Command Prompt as Administrator:
```
netsh advfirewall firewall add rule name="Al Raziq POS" dir=in action=allow protocol=TCP localport=7000
```

### Port 7000 already in use
→ Another instance of the POS is running. Close all terminal windows and try again.

---

## 📁 What Each Folder Does (For Reference)

| Folder/File | Purpose |
|---|---|
| `Launch_App.bat` | The one-click launcher — this is what your Desktop shortcut runs |
| `server/index.cjs` | The backend server (stores all data in SQLite) |
| `dist/` | The built UI (what appears in the browser) |
| `node_modules/` | Auto-downloaded libraries — never edit this |
| `scripts/` | Helper scripts (shortcut creation, icon, etc.) |
| `~/.al-raziq-pos/pos.db` | Your actual POS data (orders, staff, settings) — **back this up!** |

---

## 💾 Data Backup

Your POS data is saved in:
```
C:\Users\[YourName]\.al-raziq-pos\pos.db
```

> **Back up this file regularly!** Copy it to a USB drive or cloud storage.  
> To restore: copy the `.db` file back to the same location.

---

## ✅ Quick-Reference Checklist (New PC Setup)

- [ ] Install Node.js v22+ from nodejs.org
- [ ] Copy `al-raziq-pos-main` folder to Desktop
- [ ] Open CMD inside the folder → run `npm install`
- [ ] Run `npm install --prefix server`
- [ ] Run `powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1`
- [ ] Double-click **"Open Al Raziq POS"** icon
- [ ] Allow Windows Firewall when prompted
- [ ] ✅ Done — POS is running!
