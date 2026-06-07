const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isDevMode = process.argv.includes('--dev');

// 主进程中的设置缓存
let appSettings = {
  exitBehavior: 'minimize',
  defaultView: 'grid',
  autoLaunch: false,
  accentColor: '#6c5ce7',
};

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// 确保单实例运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 启动 Express 服务器
function startServer() {
  return new Promise((resolve, reject) => {
    // 在打包后的应用中，使用子进程启动服务器
    const serverScript = path.join(__dirname, 'server.js');

    serverProcess = spawn('node', [serverScript], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('GameVault')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });

    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
    });

    // 超时处理
    setTimeout(() => resolve(), 3000);
  });
}

// 创建主窗口
function createMainWindow() {
  // 应用图标路径
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'GameVault - 游戏管理系统',
    icon: iconPath,
    show: false, // 先隐藏，加载完成后再显示
    backgroundColor: '#0a0a12',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    // 无边框窗口（可选，取消注释以启用自定义标题栏）
    // frame: false,
    // titleBarStyle: 'hiddenInset',
  });

  // 加载应用页面
  mainWindow.loadURL(SERVER_URL);

  // 页面加载完成后显示窗口
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // 加载失败时显示错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    dialog.showErrorBox('加载失败', `无法加载应用: ${errorDescription}`);
  });

  // 开发模式下打开开发者工具
  if (isDevMode) {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时的行为（根据设置决定）
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      if (appSettings.exitBehavior === 'minimize') {
        event.preventDefault();
        mainWindow.hide();
        return false;
      }
      // 如果是 'exit'，不阻止关闭，直接退出
    }
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 在外部链接中打开 URL
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 创建系统托盘
function createTray() {
  // 使用应用图标作为托盘图标
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;

  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('GameVault - 游戏管理系统');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 GameVault',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '访问网站',
      click: () => shell.openExternal(SERVER_URL)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 创建应用菜单
function createAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入游戏',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('App.showAddModal()');
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        { type: 'separator' },
        {
          label: '缩放',
          submenu: [
            {
              label: '放大',
              accelerator: 'CmdOrCtrl+=',
              click: () => {
                if (mainWindow) {
                  const zoom = mainWindow.webContents.getZoomLevel();
                  mainWindow.webContents.setZoomLevel(zoom + 0.5);
                }
              }
            },
            {
              label: '缩小',
              accelerator: 'CmdOrCtrl+-',
              click: () => {
                if (mainWindow) {
                  const zoom = mainWindow.webContents.getZoomLevel();
                  mainWindow.webContents.setZoomLevel(zoom - 0.5);
                }
              }
            },
            {
              label: '重置',
              accelerator: 'CmdOrCtrl+0',
              click: () => {
                if (mainWindow) mainWindow.webContents.setZoomLevel(0);
              }
            }
          ]
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 GameVault',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 GameVault',
              message: 'GameVault - 电脑游戏管理系统',
              detail: '版本 1.0.0\n\n一个精美、功能完善的电脑游戏管理系统，\n帮助你管理游戏库、追踪游玩时长、自定义封面等。\n\n© 2024 GameVault',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 处理器 - 文件选择对话框
ipcMain.handle('select-exe-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择游戏可执行文件',
    filters: [
      { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'msi'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('select-image-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择封面图片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 读取文件为 base64
ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const fs = require('fs');
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');

    // 获取 MIME 类型
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    return { base64, mimeType, fileName: path.basename(filePath) };
  } catch (err) {
    console.error('读取文件失败:', err);
    return null;
  }
});

// 更新设置（从渲染进程接收）
ipcMain.handle('update-settings', async (event, settings) => {
  appSettings = { ...appSettings, ...settings };
  console.log('设置已更新:', appSettings);
  return appSettings;
});

// 从文件加载设置
function loadSettingsFromFile() {
  const settingsPath = path.join(__dirname, 'data', 'gamevault.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (data.settings) {
        appSettings = { ...appSettings, ...data.settings };
        console.log('已加载设置:', appSettings);
      }
    }
  } catch (e) {
    console.error('加载设置失败:', e.message);
  }
}

// 应用准备就绪
app.whenReady().then(async () => {
  try {
    // 加载设置
    loadSettingsFromFile();

    // 创建应用菜单
    createAppMenu();

    // 启动服务器
    await startServer();

    // 创建窗口
    createMainWindow();

    // 创建托盘
    createTray();

    // macOS dock 点击行为
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        mainWindow.show();
      }
    });

  } catch (err) {
    dialog.showErrorBox('启动失败', `应用启动失败: ${err.message}`);
    app.quit();
  }
});

// 所有窗口关闭时
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  app.isQuitting = true;

  // 关闭服务器进程
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
