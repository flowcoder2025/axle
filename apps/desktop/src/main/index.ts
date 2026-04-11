/**
 * Electron main process entry point.
 * Manages app lifecycle, BrowserWindow creation, and system tray.
 */

import type { App, BrowserWindow as BW, Tray as TrayType, Menu as MenuType } from "electron";

// Type-only references for mocking in tests
declare const app: App;
declare const BrowserWindow: typeof BW;
declare const Tray: typeof TrayType;
declare const Menu: typeof MenuType;
declare const __dirname: string;

import { registerRecorderHandlers } from "./ipc/recorder";
import { registerCertHandlers } from "./ipc/cert";
import { registerPortalHandlers } from "./ipc/portal";

const WEB_APP_URL =
  process.env.AXLE_WEB_URL ?? "http://localhost:3000";

let mainWindow: BW | null = null;
let tray: TrayType | null = null;

function createWindow(): BW {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: `${__dirname}/../preload/index.js`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(WEB_APP_URL);

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

function createTray(): TrayType {
  const icon = `${__dirname}/../../build/icon.png`;
  const t = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "AXLE 열기", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "종료", role: "quit" },
  ]);

  t.setToolTip("AXLE");
  t.setContextMenu(contextMenu);

  t.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });

  return t;
}

function bootstrap(): void {
  // Register IPC handlers before window is created
  registerRecorderHandlers();
  registerCertHandlers();
  registerPortalHandlers();

  app.on("ready", () => {
    mainWindow = createWindow();
    tray = createTray();
  });

  app.on("window-all-closed", () => {
    // On macOS keep app running in tray when all windows are closed
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      mainWindow = createWindow();
    } else {
      mainWindow.show();
    }
  });

  app.on("before-quit", () => {
    tray?.destroy();
    tray = null;
  });
}

bootstrap();
