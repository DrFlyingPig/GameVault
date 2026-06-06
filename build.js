const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'release');
const APP_DIR = path.join(DIST_DIR, 'GameVault-win32-x64');

console.log('========================================');
console.log('  GameVault - 打包工具');
console.log('========================================\n');

// 备份现有数据（如果有）
const existingDataDir = path.join(APP_DIR, 'resources', 'app', 'data');
const existingUploadsDir = path.join(APP_DIR, 'resources', 'app', 'uploads');
let hasExistingData = false;
let backupDataDir = null;
let backupUploadsDir = null;

if (fs.existsSync(existingDataDir)) {
  hasExistingData = true;
  backupDataDir = path.join(ROOT_DIR, '.backup_data');
  backupUploadsDir = path.join(ROOT_DIR, '.backup_uploads');

  console.log('[1/6] 备份现有游戏数据...');
  if (fs.existsSync(backupDataDir)) fs.rmSync(backupDataDir, { recursive: true });
  if (fs.existsSync(backupUploadsDir)) fs.rmSync(backupUploadsDir, { recursive: true });

  fs.cpSync(existingDataDir, backupDataDir, { recursive: true });
  if (fs.existsSync(existingUploadsDir)) {
    fs.cpSync(existingUploadsDir, backupUploadsDir, { recursive: true });
  }
  console.log('  ✓ 数据已备份');
} else {
  console.log('[1/6] 无现有数据需要备份');
}

// 清理旧的构建文件（如果被锁定则跳过）
console.log('[2/6] 更新应用文件...');
if (fs.existsSync(DIST_DIR)) {
  try {
    // 只删除应用文件，保留数据
    const resourcesAppDir = path.join(APP_DIR, 'resources', 'app');
    if (fs.existsSync(resourcesAppDir)) {
      // 删除应用文件但保留 data 和 uploads 目录
      const items = fs.readdirSync(resourcesAppDir);
      for (const item of items) {
        if (item === 'data' || item === 'uploads') continue;
        const itemPath = path.join(resourcesAppDir, item);
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.log('  (部分文件更新跳过)');
  }
}

// 创建应用目录
console.log('[3/6] 创建应用目录结构...');
fs.mkdirSync(APP_DIR, { recursive: true });

// 复制文件的函数
function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// 复制 Electron 运行时
console.log('[4/6] 复制 Electron 运行时...');
const electronDist = path.join(ROOT_DIR, 'node_modules', 'electron', 'dist');
if (fs.existsSync(electronDist)) {
  copyDir(electronDist, APP_DIR);

  // 重命名 electron.exe 为 GameVault.exe
  const electronExe = path.join(APP_DIR, 'electron.exe');
  const gamevaultExe = path.join(APP_DIR, 'GameVault.exe');
  if (fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, gamevaultExe);
  }
}

// 创建 resources/app 目录（Electron 会从这里加载应用）
console.log('[5/6] 复制应用文件...');
const appResourcesDir = path.join(APP_DIR, 'resources', 'app');
fs.mkdirSync(appResourcesDir, { recursive: true });

// 复制应用核心文件
copyFile(path.join(ROOT_DIR, 'main.js'), path.join(appResourcesDir, 'main.js'));
copyFile(path.join(ROOT_DIR, 'preload.js'), path.join(appResourcesDir, 'preload.js'));
copyFile(path.join(ROOT_DIR, 'server.js'), path.join(appResourcesDir, 'server.js'));
copyFile(path.join(ROOT_DIR, 'database.js'), path.join(appResourcesDir, 'database.js'));
copyFile(path.join(ROOT_DIR, 'package.json'), path.join(appResourcesDir, 'package.json'));

// 复制应用图标
if (fs.existsSync(path.join(ROOT_DIR, 'icon.png'))) {
  copyFile(path.join(ROOT_DIR, 'icon.png'), path.join(appResourcesDir, 'icon.png'));
}

// 复制前端文件
copyDir(path.join(ROOT_DIR, 'public'), path.join(appResourcesDir, 'public'));

// 复制 node_modules（排除 electron 等开发依赖）
console.log('  复制运行时依赖...');
const skipDeps = ['electron', '@electron'];
const nmSrc = path.join(ROOT_DIR, 'node_modules');
const nmDest = path.join(appResourcesDir, 'node_modules');
fs.mkdirSync(nmDest, { recursive: true });
const nmItems = fs.readdirSync(nmSrc);
for (const item of nmItems) {
  if (skipDeps.includes(item)) continue;
  const srcPath = path.join(nmSrc, item);
  const destPath = path.join(nmDest, item);
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    copyDir(srcPath, destPath);
  } else {
    copyFile(srcPath, destPath);
  }
}

// 恢复备份的数据（如果有）
console.log('[6/6] 恢复游戏数据...');
const dataDir = path.join(appResourcesDir, 'data');
const uploadsDir = path.join(appResourcesDir, 'uploads');

if (hasExistingData && backupDataDir && fs.existsSync(backupDataDir)) {
  // 恢复数据目录
  fs.mkdirSync(dataDir, { recursive: true });
  fs.cpSync(backupDataDir, dataDir, { recursive: true });
  console.log('  ✓ 游戏数据已恢复');

  // 恢复上传目录
  if (backupUploadsDir && fs.existsSync(backupUploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.cpSync(backupUploadsDir, uploadsDir, { recursive: true });
    console.log('  ✓ 上传文件已恢复');
  }

  // 清理备份
  fs.rmSync(backupDataDir, { recursive: true, force: true });
  if (fs.existsSync(backupUploadsDir)) {
    fs.rmSync(backupUploadsDir, { recursive: true, force: true });
  }
} else {
  // 首次打包，创建空目录
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('  ✓ 数据目录已创建');
}

// 删除 default_app.asar（使用我们的 app 目录代替）
const defaultAsar = path.join(APP_DIR, 'resources', 'default_app.asar');
if (fs.existsSync(defaultAsar)) {
  fs.unlinkSync(defaultAsar);
}

// 创建启动脚本
const launchScript = `@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         🎮 GameVault 游戏管理系统         ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  正在启动 GameVault...
start "" "%~dp0GameVault.exe" --no-sandbox
`;
fs.writeFileSync(path.join(APP_DIR, '启动GameVault.bat'), launchScript, 'utf-8');

// 创建 README
const readme = `GameVault - 电脑游戏管理系统
============================

使用方法
--------
1. 双击 "GameVault.exe" 启动应用
2. 或者运行 "启动GameVault.bat"

功能特性
--------
- 游戏库管理（网格/列表视图）
- 游戏导入与一键启动
- 游玩时长自动记录
- 自定义游戏封面
- 分类标签管理
- 统计面板与排行榜
- 收藏系统
- 搜索与筛选

数据存储
--------
- 游戏数据: resources/app/data/gamevault.json
- 上传的封面: resources/app/uploads/

快捷键
------
- Ctrl+K: 搜索
- Ctrl+I: 导入游戏
- F11: 全屏
- F12: 开发者工具
- Escape: 关闭弹窗

技术支持
--------
如有问题，请查看 README.md 文件
`;
fs.writeFileSync(path.join(APP_DIR, 'README.txt'), readme, 'utf-8');

// 计算总大小
function getDirectorySize(dir) {
  let size = 0;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      size += getDirectorySize(itemPath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

console.log('\n========================================');
console.log('  打包完成！');
console.log('========================================\n');
console.log(`  输出目录: ${APP_DIR}`);
console.log(`  运行文件: ${path.join(APP_DIR, 'GameVault.exe')}`);

const totalSize = getDirectorySize(APP_DIR);
console.log(`\n  总大小: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

const exeStats = fs.statSync(path.join(APP_DIR, 'GameVault.exe'));
console.log(`  GameVault.exe: ${(exeStats.size / 1024 / 1024).toFixed(1)} MB`);

console.log('\n========================================\n');
