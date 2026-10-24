const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  showNotification: (payload) => {
    ipcRenderer.send("show-notification", payload);
  },
  flashFrame: () => {
    ipcRenderer.send("flash-frame");
  },
  showOverlay: () => {
    ipcRenderer.send("overlay:show");
  },
  hideOverlay: () => {
    ipcRenderer.send("overlay:hide");
  },
  hideMainWindow: () => {
    ipcRenderer.send("app:hide");
  },
  showMainWindow: () => {
    ipcRenderer.send("app:show");
  },
  setBadgeCount: (count) => {
    ipcRenderer.send("set-badge-count", count);
  },
  onNavigate: (callback) => {
    ipcRenderer.on("navigate-to", (_event, url) => {
      callback(url);
    });
  },
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  applyHotUpdate: () => ipcRenderer.invoke("apply-hot-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});

// Forward navigate-to events directly to window custom event for React Router
ipcRenderer.on("navigate-to", (_event, targetUrl) => {
  window.dispatchEvent(
    new CustomEvent("flick:push-navigate", {
      detail: { url: targetUrl },
    })
  );
});

// Forward system resume events for reconnect notifications
ipcRenderer.on("system-resume", () => {
  window.dispatchEvent(new CustomEvent("flick:system-resume"));
});
