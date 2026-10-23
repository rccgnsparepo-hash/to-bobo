const { app, BrowserWindow, ipcMain, Notification, protocol, net, shell, powerMonitor, session, Tray, Menu } = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");

const APP_ID = "com.faratech.faraflick";

// Set Application User Model ID for Windows 10/11 Action Center & Toast Notifications
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

// Configure automatic launch on Windows startup
try {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    name: "Flick",
  });
} catch (err) {
  console.warn("[Electron] Startup setting warning:", err);
}

// Register custom scheme privilege before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
    },
  },
]);

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "../public/icon-512.png");
  tray = new Tray(iconPath);
  tray.setToolTip("Flick - Modern Social, Stories & Chat");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Flick",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Direct Messages & Chats",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send("navigate-to", "/messages");
        }
      },
    },
    { type: "separator" },
    {
      label: "Launch at Windows Startup",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true,
          name: "Flick",
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit Flick",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 420,
    minHeight: 600,
    title: "Flick",
    icon: path.join(__dirname, "../public/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    // If launched with --hidden argument, stay in tray
    const startHidden = process.argv.includes("--hidden");
    if (mainWindow && !startHidden) {
      mainWindow.show();
    }
  });

  // Minimize to System Tray when user clicks the Close (X) button
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported() && process.platform === "win32") {
        new Notification({
          title: "Flick is still running",
          body: "Flick is minimized to the system tray and will notify you of new Flicks.",
          icon: path.join(__dirname, "../public/icon-512.png"),
          silent: true,
        }).show();
      }
    }
  });

  // Handle external link clicks securely
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith("http:") || targetUrl.startsWith("https:")) {
      shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  // Load production build using custom app:// scheme or dev server
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadURL("app://localhost/index.html");
  }
}

app.whenReady().then(() => {
  // Protocol handler for app:// to serve local files correctly with SPA routing fallback
  const distDir = path.join(__dirname, "../dist");

  protocol.handle("app", (request) => {
    const parsed = new URL(request.url);
    let filePath = path.normalize(path.join(distDir, parsed.pathname));

    // Security check: ensure path stays inside dist directory
    if (!filePath.startsWith(distDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }

    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  createWindow();
  createTray();

  // Explicitly grant microphone, camera, and notification permissions
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ["media", "audioCapture", "mediaKeySystem", "notifications"];
      if (allowed.includes(permission)) {
        return callback(true);
      }
      callback(false);
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      const allowed = ["media", "audioCapture", "mediaKeySystem", "notifications"];
      return allowed.includes(permission);
    });
  }

  // Telegram-style notification trigger on system wake / resume / unlock
  if (powerMonitor) {
    powerMonitor.on("resume", () => {
      if (mainWindow) {
        mainWindow.webContents.send("system-resume");
      }
    });
    powerMonitor.on("unlock-screen", () => {
      if (mainWindow) {
        mainWindow.webContents.send("system-resume");
      }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handler: Native Windows Toast Notifications via Notification API
ipcMain.on("show-notification", (_event, payload) => {
  try {
    const { title, body, url: targetUrl } = payload || {};
    if (!Notification.isSupported()) return;

    // Strict rule: Typing must NEVER be delivered through Windows notifications
    if (
      (title && (title.includes("is typing") || title.includes("Typing"))) ||
      (body && (body.includes("is typing") || body === "Typing…"))
    ) {
      return;
    }

    const notif = new Notification({
      title: title || "Flick Notification",
      body: body || "",
      icon: path.join(__dirname, "../public/icon-512.png"),
      silent: false,
    });

    notif.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        if (targetUrl) {
          mainWindow.webContents.send("navigate-to", targetUrl);
        }
      }
    });

    notif.show();
  } catch (err) {
    console.error("[Electron] Failed to display Windows notification:", err);
  }
});

// IPC Handler: Flash taskbar icon on Windows
ipcMain.on("flash-frame", () => {
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
});

// IPC Handler: Set Application Badge Count & Tray Tooltip
ipcMain.on("set-badge-count", (_event, count) => {
  try {
    const num = typeof count === "number" ? count : 0;
    if (app.setBadgeCount) {
      app.setBadgeCount(num);
    }
    if (tray) {
      tray.setToolTip(num > 0 ? `Flick (${num} unread message${num > 1 ? "s" : ""})` : "Flick - Modern Social, Stories & Chat");
    }
  } catch (err) {
    console.warn("[Electron] setBadgeCount error:", err);
  }
});
