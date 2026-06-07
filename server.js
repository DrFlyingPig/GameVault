const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const db = require('./database');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cover_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
    const mime = allowed.test(file.mimetype.split('/')[1]) || file.mimetype === 'image/svg+xml';
    if (ext || mime) return cb(null, true);
    cb(new Error('仅支持图片文件'));
  },
});

// ============================================================
// 游戏进程追踪系统
// ============================================================

// 活跃游戏追踪 Map<gameId, TrackingInfo>
const activeTrackers = new Map();

/**
 * TrackingInfo 结构:
 * {
 *   gameId: number,
 *   sessionId: number,
 *   startTime: number,         // 开始时间戳
 *   lastActiveTime: number,    // 最后检测到进程的时间
 *   exeName: string,           // 可执行文件名 (如 "game.exe")
 *   mode: 'auto' | 'manual',  // 自动检测或手动模式
 *   paused: boolean,           // 是否暂停（进程暂时消失）
 *   pauseStartTime: number,   // 暂停开始时间
 *   totalPauseTime: number,   // 总暂停时间（毫秒）
 *   checkFailCount: number,   // 连续检测失败次数
 * }
 */

// 从完整路径提取可执行文件名
function extractExeName(exePath) {
  if (!exePath) return null;
  const parts = exePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1];
  return fileName.toLowerCase();
}

// 检查进程是否在运行
function checkProcessRunning(exeName) {
  return new Promise((resolve) => {
    // 使用 tasklist 命令检查进程
    exec('tasklist /FO CSV /NH', { encoding: 'utf-8' }, (err, stdout) => {
      if (err) {
        console.error('检查进程失败:', err.message);
        resolve(false);
        return;
      }

      // 解析 CSV 输出，查找匹配的进程名
      const lines = stdout.split('\n');
      const exeNameLower = exeName.toLowerCase();

      for (const line of lines) {
        // CSV 格式: "进程名","PID","会话名","会话#","内存使用"
        const match = line.match(/^"([^"]+)"/);
        if (match) {
          const processName = match[1].toLowerCase();
          // 精确匹配或包含匹配（处理某些游戏启动器的情况）
          if (processName === exeNameLower ||
              processName === exeNameLower + '.exe' ||
              exeNameLower.includes(processName.replace('.exe', '')) ||
              processName.includes(exeNameLower.replace('.exe', ''))) {
            resolve(true);
            return;
          }
        }
      }
      resolve(false);
    });
  });
}

// 进程监控定时器
let processMonitorInterval = null;

// 启动进程监控
function startProcessMonitor() {
  if (processMonitorInterval) return;

  const CHECK_INTERVAL = 3000;      // 每 3 秒检查一次
  const MAX_FAIL_COUNT = 2;         // 连续失败 2 次（6秒）后判定停止

  processMonitorInterval = setInterval(async () => {
    for (const [gameId, tracker] of activeTrackers) {
      // 手动模式不检查进程
      if (tracker.mode === 'manual') continue;

      // 暂停状态不检查
      if (tracker.paused) continue;

      if (tracker.exeName) {
        const isRunning = await checkProcessRunning(tracker.exeName);

        if (isRunning) {
          // 进程在运行，更新最后活跃时间
          tracker.lastActiveTime = Date.now();
          tracker.checkFailCount = 0;
        } else {
          // 进程未检测到
          tracker.checkFailCount++;

          if (tracker.checkFailCount >= MAX_FAIL_COUNT) {
            // 连续失败达到阈值，判定游戏已停止
            console.log(`游戏 ${gameId} 进程已消失，停止追踪`);
            stopGameSession(gameId);
          }
        }
      }
    }
  }, CHECK_INTERVAL);

  console.log('进程监控已启动');
}

// 停止进程监控
function stopProcessMonitor() {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval);
    processMonitorInterval = null;
  }
}

// ========== 游戏 CRUD ==========

app.get('/api/games', (req, res) => {
  const games = db.getGames(req.query);
  res.json(games);
});

app.get('/api/games/:id', (req, res) => {
  const game = db.getGame(parseInt(req.params.id));
  if (!game) return res.status(404).json({ error: '游戏不存在' });
  res.json(game);
});

app.post('/api/games', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: '游戏名称不能为空' });
  const game = db.createGame(req.body);
  res.status(201).json(game);
});

app.put('/api/games/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const game = db.updateGame(id, req.body);
  if (!game) return res.status(404).json({ error: '游戏不存在' });

  // 如果更新了可执行文件路径，更新追踪器
  if (req.body.executable_path !== undefined && activeTrackers.has(id)) {
    const tracker = activeTrackers.get(id);
    tracker.exeName = extractExeName(req.body.executable_path);
  }

  res.json(game);
});

app.delete('/api/games/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const game = db.getGame(id);
  if (!game) return res.status(404).json({ error: '游戏不存在' });

  // 停止追踪
  if (activeTrackers.has(id)) {
    stopGameSession(id);
  }

  // 清理封面文件
  if (game.cover_image && game.cover_image.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, game.cover_image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.deleteGame(id);
  res.json({ success: true });
});

// ========== 封面上传 ==========

app.post('/api/games/:id/cover', upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片文件' });

  const id = parseInt(req.params.id);
  const game = db.getGame(id);
  if (!game) return res.status(404).json({ error: '游戏不存在' });

  // 删除旧封面
  if (game.cover_image && game.cover_image.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, game.cover_image);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const coverPath = `/uploads/${req.file.filename}`;
  db.updateGame(id, { cover_image: coverPath });
  res.json({ cover_image: coverPath });
});

// ========== 游戏启动/停止 ==========

app.post('/api/games/:id/launch', async (req, res) => {
  const id = parseInt(req.params.id);
  const game = db.getGame(id);
  if (!game) return res.status(404).json({ error: '游戏不存在' });

  if (activeTrackers.has(id)) {
    return res.status(400).json({ error: '游戏已在运行中' });
  }

  // 提取可执行文件名
  const exeName = extractExeName(game.executable_path);
  let mode = 'manual'; // 默认手动模式
  let alreadyRunning = false;

  // 情况1：设置了路径
  if (game.executable_path) {
    // 检查路径是否存在
    if (!fs.existsSync(game.executable_path)) {
      // 路径无效，返回错误
      return res.status(400).json({
        error: '游戏路径无效，请检查可执行文件路径是否正确',
        path: game.executable_path
      });
    }

    // 路径有效，检查游戏是否已在运行
    if (exeName) {
      alreadyRunning = await checkProcessRunning(exeName);
    }

    if (!alreadyRunning) {
      // 尝试启动游戏
      try {
        exec(`start "" "${game.executable_path}"`, {
          cwd: path.dirname(game.executable_path),
          windowsHide: true,
        }, (err) => {
          if (err) console.error('启动游戏失败:', err.message);
        });
        mode = 'auto';
      } catch (err) {
        console.error('启动游戏失败:', err.message);
        return res.status(500).json({ error: '启动游戏失败: ' + err.message });
      }
    } else {
      // 游戏已在运行，直接追踪
      mode = 'auto';
    }
  }
  // 情况2：没有设置路径，进入手动模式

  // 创建游玩会话
  const session = db.createSession(id);
  db.setLastPlayed(id);

  // 创建追踪器
  const tracker = {
    gameId: id,
    sessionId: session.id,
    startTime: Date.now(),
    lastActiveTime: Date.now(),
    exeName: exeName,
    mode: mode,
    paused: false,
    pauseStartTime: 0,
    totalPauseTime: 0,
    checkFailCount: 0,
  };

  activeTrackers.set(id, tracker);
  startProcessMonitor();

  let message = '';
  if (mode === 'auto') {
    if (alreadyRunning) {
      message = `检测到 ${game.title} 已在运行，开始追踪`;
    } else {
      message = `正在启动 ${game.title}，开始自动追踪`;
    }
  } else {
    message = `${game.title} 已开始计时（手动模式）`;
  }

  res.json({
    success: true,
    message,
    sessionId: session.id,
    tracking: true,
    mode,
    exeName,
  });
});

app.post('/api/games/:id/stop', (req, res) => {
  const result = stopGameSession(parseInt(req.params.id));
  if (result) {
    res.json(result);
  } else {
    res.status(400).json({ error: '游戏未在运行' });
  }
});

function stopGameSession(gameId) {
  const tracker = activeTrackers.get(gameId);
  if (!tracker) return null;

  // 计算实际游玩时长（减去暂停时间）
  const now = Date.now();
  let totalElapsed = now - tracker.startTime - tracker.totalPauseTime;

  // 如果当前处于暂停状态，还要减去当前暂停的时长
  if (tracker.paused) {
    totalElapsed -= (now - tracker.pauseStartTime);
  }

  const duration = Math.max(0, Math.floor(totalElapsed / 1000));

  // 更新数据库
  db.endSession(tracker.sessionId, duration);
  db.addPlaytime(gameId, duration);

  // 移除追踪器
  activeTrackers.delete(gameId);

  // 如果没有活跃追踪器，停止监控
  if (activeTrackers.size === 0) {
    stopProcessMonitor();
  }

  const game = db.getGame(gameId);
  return {
    success: true,
    message: `${game.title} 已停止`,
    duration,
    total_playtime: game.total_playtime,
    mode: tracker.mode,
  };
}

app.get('/api/games/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const tracker = activeTrackers.get(id);

  if (tracker) {
    const now = Date.now();
    let elapsed = now - tracker.startTime - tracker.totalPauseTime;

    if (tracker.paused) {
      elapsed -= (now - tracker.pauseStartTime);
    }

    res.json({
      running: true,
      elapsed: Math.max(0, Math.floor(elapsed / 1000)),
      mode: tracker.mode,
      paused: tracker.paused,
      exeName: tracker.exeName,
    });
  } else {
    res.json({ running: false });
  }
});

app.get('/api/active', (req, res) => {
  const active = [];
  const now = Date.now();

  for (const [gameId, tracker] of activeTrackers) {
    const game = db.getGame(gameId);
    if (game) {
      let elapsed = now - tracker.startTime - tracker.totalPauseTime;
      if (tracker.paused) {
        elapsed -= (now - tracker.pauseStartTime);
      }

      active.push({
        id: game.id,
        title: game.title,
        elapsed: Math.max(0, Math.floor(elapsed / 1000)),
        mode: tracker.mode,
        paused: tracker.paused,
      });
    }
  }
  res.json(active);
});

// ========== 游玩会话 ==========

app.get('/api/games/:id/sessions', (req, res) => {
  res.json(db.getSessions(parseInt(req.params.id)));
});

// ========== 分类 ==========

app.get('/api/categories', (req, res) => {
  res.json(db.getCategories());
});

app.post('/api/categories', (req, res) => {
  const { name, icon } = req.body;
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  const cat = db.createCategory(name, icon || '📁');
  if (!cat) return res.status(400).json({ error: '分类已存在' });
  res.status(201).json(cat);
});

app.delete('/api/categories/:id', (req, res) => {
  db.deleteCategory(parseInt(req.params.id));
  res.json({ success: true });
});

// ========== 设置 ==========

app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req, res) => {
  const settings = db.updateSettings(req.body);
  res.json(settings);
});

// ========== 统计 ==========

app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  stats.activeCount = activeTrackers.size;
  res.json(stats);
});

// ========== 启动服务器 ==========

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port || PORT, () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║         🎮 GameVault 服务器已启动         ║
  ║                                          ║
  ║    访问地址: http://localhost:${port || PORT}        ║
  ╚══════════════════════════════════════════╝
  `);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// 直接运行时自动启动
if (require.main === module) {
  startServer().catch(err => {
    console.error('服务器启动失败:', err);
    process.exit(1);
  });
}

module.exports = { startServer, app };
