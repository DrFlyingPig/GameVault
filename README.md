# 🎮 GameVault - 电脑游戏管理系统

一个精美、功能完善的电脑游戏管理系统，帮助你管理游戏库、追踪游玩时长、自定义封面等。

## ✨ 核心功能

- **游戏库管理** - 网格/列表视图展示，搜索、分类筛选
- **游戏导入** - 支持手动输入游戏信息和可执行文件路径
- **一键启动** - 直接从界面启动游戏
- **时长记录** - 自动追踪游戏运行时长（进程检测 + 手动模式）
- **自定义封面** - 上传/更换游戏封面图片
- **分类标签** - 自定义分类管理游戏（13个预设分类 + 自定义）
- **收藏功能** - 标记收藏游戏，快速访问
- **游戏详情** - 详情面板展示描述、统计、备注、标签
- **评分系统** - 5星评分，支持排序
- **统计仪表盘** - 游戏时长统计、最常玩排行、分类分布
- **游玩记录** - 每次游玩的详细记录

## 🎨 设计特色

- 深色主题 + 毛玻璃效果
- 流畅的过渡动画
- 参考 Steam/Epic Games 设计语言
- 响应式布局

## 🚀 快速开始

### 方式一：从源码运行（推荐）

```bash
git clone https://github.com/DrFlyingPig/GameVault.git
cd GameVault
npm install
npm start
```

### 方式二：打包为 EXE

```bash
npm install
npm run build
```

打包完成后，进入 `release/GameVault-win32-x64` 目录，双击 `GameVault.exe` 即可运行。

## 📖 使用指南

### 导入游戏

1. 点击右上角的 **+** 按钮
2. 填写游戏名称（必填）
3. 可选填写：可执行文件路径、开发商、发行商、分类、标签、简介
4. 点击保存

### 启动游戏

- 在游戏卡片上点击播放按钮
- 或在详情面板中点击"启动游戏"
- 如果设置了可执行文件路径，会自动启动游戏并追踪进程
- 如果没有设置路径，进入手动计时模式

### 自定义封面

1. 打开游戏详情面板
2. 点击封面图上的"更换封面"
3. 选择图片文件上传

### 查看统计

点击右上角的统计图标，查看：
- 游戏总数和总时长
- 游玩时长排行榜
- 分类分布统计
- 最近游玩记录

## 🛠️ 技术栈

- **前端**: 原生 HTML/CSS/JavaScript
- **后端**: Node.js + Express
- **桌面**: Electron
- **存储**: JSON 文件数据库

## 📁 项目结构

```
GameVault/
├── main.js              # Electron 主进程
├── preload.js           # Electron 预加载脚本
├── server.js            # Express 后端
├── database.js          # JSON 数据库
├── build.js             # 打包脚本
├── package.json         # 项目配置
├── icon.png             # 应用图标
└── public/
    ├── index.html       # 主页面
    ├── css/style.css    # 样式文件
    └── js/
        ├── app.js       # 主应用逻辑
        ├── api.js       # API 封装
        ├── ui.js        # UI 组件
        └── utils.js     # 工具函数
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 聚焦搜索框 |
| `Ctrl + I` | 导入游戏 |
| `Ctrl + R` | 刷新页面 |
| `F11` | 全屏切换 |
| `F12` | 开发者工具 |
| `Escape` | 关闭弹窗 |

## 📝 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/games | 获取游戏列表 |
| POST | /api/games | 导入游戏 |
| PUT | /api/games/:id | 更新游戏 |
| DELETE | /api/games/:id | 删除游戏 |
| POST | /api/games/:id/launch | 启动游戏 |
| POST | /api/games/:id/stop | 停止游戏 |
| POST | /api/games/:id/cover | 上传封面 |
| GET | /api/games/:id/status | 获取运行状态 |
| GET | /api/games/:id/sessions | 获取游玩记录 |
| GET | /api/stats | 获取统计 |
| GET | /api/categories | 获取分类 |
| POST | /api/categories | 创建分类 |
| DELETE | /api/categories/:id | 删除分类 |

## 📄 许可证

MIT License
