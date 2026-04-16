// Главный процесс Electron: встраиваем внутрь Next.js-сервер
// и открываем его в отдельном окне как полноценное приложение.

const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const url = require("url");
const next = require("next");

// В dev-режиме включаем горячую перезагрузку, в проде — собранный Next
const dev = !app.isPackaged;
const port = parseInt(process.env.PORT || "3000", 10);

let mainWindow = null;

async function prepareNextServer() {
  const dir = path.join(__dirname);
  const nextApp = next({ dev, dir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#020617",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = `http://localhost:${port}`;
  mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (dev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await prepareNextServer();
    createMainWindow();
  } catch (err) {
    console.error("Не удалось запустить Next.js внутри Electron:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

