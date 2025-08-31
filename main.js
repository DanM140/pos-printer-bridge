// main.js
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let tray;
let agentProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
}

app.whenReady().then(() => {
  // ✅ Enable autostart when Windows boots
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
    args: [] // you can pass custom args if needed
  });

  // Start local agent
  agentProcess = fork(path.join(__dirname, 'agent.js'));

  // Create main window
  createWindow();

  // Tray icon for background mode
  tray = new Tray(path.join(__dirname, 'icon.jpg')); // put an icon.jpg in root
  const menu = Menu.buildFromTemplate([
    { label: 'Open Agent', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip("POS Print Agent");

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Keep running in background when window closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
  mainWindow = null;
});

// Kill agent process when quitting app fully
app.on('quit', () => {
  if (agentProcess) agentProcess.kill();
});
