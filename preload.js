const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择可执行文件
  selectExeFile: () => ipcRenderer.invoke('select-exe-file'),

  // 选择图片文件（封面）
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),

  // 读取文件内容（返回 base64）
  readFileAsBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),

  // 更新设置（通知主进程）
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),

  // 获取平台信息
  platform: process.platform,
});
