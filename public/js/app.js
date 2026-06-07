/* ============================================================
   GameVault - 主应用逻辑
   ============================================================ */

const App = {
  games: [],
  categories: [],
  settings: {},
  currentCategory: '全部游戏',
  currentSort: 'recent',
  currentSearch: '',
  selectedGame: null,
  runningGames: new Map(), // gameId -> elapsed seconds
  editMode: false,
  _timers: [],

  // 初始化
  async init() {
    await App.loadSettings();
    await App.loadCategories();
    await App.loadGames();
    App.bindEvents();
    App.startStatusPolling();
    App.bindKeyboardShortcuts();

    // 应用设置
    App.applySettings();

    // 渲染初始评分星星
    UI.renderRatingStars(0, true);
  },

  // ========== 数据加载 ==========

  async loadCategories() {
    try {
      App.categories = await API.getCategories();
      UI.renderSidebar(App.categories, App.allGames || App.games);
      UI.renderCategorySelect(App.categories);
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  async loadGames() {
    try {
      const params = {};
      if (App.currentSearch) params.search = App.currentSearch;
      if (App.currentCategory === '收藏夹') params.favorites = '1';
      else if (App.currentCategory === '最近游玩') params.category = '最近游玩';
      else if (App.currentCategory !== '全部游戏') params.category = App.currentCategory;
      params.sort = App.currentSort;

      const [games, allGames] = await Promise.all([
        API.getGames(params),
        API.getGames({ sort: App.currentSort }),
      ]);
      App.games = games;
      App.allGames = allGames;
      UI.renderGamesGrid(App.games);
      UI.renderSidebar(App.categories, App.allGames);
    } catch (err) {
      console.error('加载游戏失败:', err);
      Utils.showToast('加载游戏列表失败', 'error');
    }
  },

  async loadSettings() {
    try {
      App.settings = await API.getSettings();
    } catch (err) {
      console.error('加载设置失败:', err);
      App.settings = {};
    }
  },

  applySettings() {
    // 应用默认视图
    if (App.settings.defaultView === 'list') {
      UI.setViewMode('list');
    }

    // 应用主题色
    if (App.settings.accentColor) {
      document.documentElement.style.setProperty('--accent', App.settings.accentColor);
      // 计算更亮的版本
      const lighterColor = App.settings.accentColor + '99';
      document.documentElement.style.setProperty('--accent-glow', lighterColor);
    }
  },

  // ========== 事件绑定 ==========

  bindEvents() {
    // 搜索
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      App.currentSearch = e.target.value.trim();
      App.loadGames();
    }, 300));

    // 排序
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      App.currentSort = e.target.value;
      App.loadGames();
    });

    // 视图切换
    document.getElementById('btnGridView').addEventListener('click', () => UI.setViewMode('grid'));
    document.getElementById('btnListView').addEventListener('click', () => UI.setViewMode('list'));

    // 导入游戏按钮
    document.getElementById('btnAddGame').addEventListener('click', () => App.showAddModal());
    document.getElementById('btnAddGameEmpty').addEventListener('click', () => App.showAddModal());

    // 统计面板
    document.getElementById('btnStats').addEventListener('click', () => App.showStats());

    // 设置面板
    document.getElementById('btnSettings').addEventListener('click', () => App.showSettingsModal());

    // 添加分类
    document.getElementById('btnAddCategory').addEventListener('click', () => App.showCategoryModal());

    // 弹窗关闭
    document.getElementById('addGameClose').addEventListener('click', () => App.closeAddModal());
    document.getElementById('addGameCancel').addEventListener('click', () => App.closeAddModal());
    document.getElementById('statsClose').addEventListener('click', () => App.closeStatsModal());
    document.getElementById('categoryClose').addEventListener('click', () => App.closeCategoryModal());
    document.getElementById('categoryCancel').addEventListener('click', () => App.closeCategoryModal());
    document.getElementById('settingsClose').addEventListener('click', () => App.closeSettingsModal());

    // 保存游戏
    document.getElementById('addGameSave').addEventListener('click', () => App.saveGame());

    // 保存分类
    document.getElementById('categorySave').addEventListener('click', () => App.saveCategory());

    // 保存设置
    document.getElementById('settingsSave').addEventListener('click', () => App.saveSettings());

    // 主题色选择
    document.querySelectorAll('.color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 详情面板
    document.getElementById('detailClose').addEventListener('click', () => App.closeDetail());
    document.getElementById('detailOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) App.closeDetail();
    });

    // 详情面板操作
    document.getElementById('btnLaunch').addEventListener('click', () => App.launchGame());
    document.getElementById('btnStop').addEventListener('click', () => App.stopGame());
    document.getElementById('btnFavorite').addEventListener('click', () => App.toggleFavoriteFromDetail());
    document.getElementById('btnEdit').addEventListener('click', () => App.editFromDetail());
    document.getElementById('btnDelete').addEventListener('click', () => App.deleteFromDetail());

    // 封面上传
    document.getElementById('btnChangeCover').addEventListener('click', async () => {
      if (window.electronAPI) {
        // Electron 环境：使用原生文件选择对话框
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
          // 读取文件并上传
          App.uploadCoverFromPath(filePath);
        }
      } else {
        // Web 环境：使用 input file
        document.getElementById('coverFileInput').click();
      }
    });
    document.getElementById('coverFileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) App.uploadCover(e.target.files[0]);
    });

    // 评分输入
    document.getElementById('ratingInput').addEventListener('click', (e) => {
      if (e.target.classList.contains('star')) {
        const val = parseInt(e.target.dataset.value);
        UI.renderRatingStars(val, true);
      }
    });

    // 备注和标签自动保存
    document.getElementById('detailNotes').addEventListener('blur', () => App.saveNotesAndTags());
    document.getElementById('detailTags').addEventListener('blur', () => App.saveNotesAndTags());

    // 浏览按钮 - 选择可执行文件
    document.getElementById('btnBrowse').addEventListener('click', async () => {
      // 检查是否在 Electron 环境中
      if (window.electronAPI) {
        const filePath = await window.electronAPI.selectExeFile();
        if (filePath) {
          document.getElementById('gameExePath').value = filePath;
        }
      } else {
        // Web 环境下提示手动输入
        Utils.showToast('请直接输入游戏可执行文件的完整路径', 'info');
      }
    });

    // 弹窗点击外部关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  },

  // 键盘快捷键
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K 聚焦搜索
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
      // Escape 关闭弹窗
      if (e.key === 'Escape') {
        App.closeDetail();
        App.closeAddModal();
        App.closeStatsModal();
        App.closeCategoryModal();
        document.getElementById('confirmModal').classList.remove('active');
      }
    });
  },

  // ========== 分类管理 ==========

  setCategory(name) {
    App.currentCategory = name;
    document.getElementById('contentTitle').textContent = name;
    App.loadGames();
  },

  showCategoryModal() {
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryIcon').value = '📁';
    document.getElementById('categoryModal').classList.add('active');
    document.getElementById('categoryName').focus();
  },

  closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
  },

  async saveCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const icon = document.getElementById('categoryIcon').value.trim() || '📁';

    if (!name) {
      Utils.showToast('请输入分类名称', 'warning');
      return;
    }

    try {
      await API.createCategory({ name, icon });
      await App.loadCategories();
      App.closeCategoryModal();
      Utils.showToast(`分类 "${name}" 已创建`, 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  // ========== 游戏导入/编辑 ==========

  showAddModal(game = null) {
    App.editMode = !!game;
    document.getElementById('modalTitle').textContent = game ? '编辑游戏' : '导入游戏';

    // 填充表单
    document.getElementById('gameTitle').value = game?.title || '';
    document.getElementById('gameExePath').value = game?.executable_path || '';
    document.getElementById('gameDeveloper').value = game?.developer || '';
    document.getElementById('gamePublisher').value = game?.publisher || '';
    document.getElementById('gameYear').value = game?.release_year || '';
    document.getElementById('gameTags').value = game?.tags || '';
    document.getElementById('gameDescription').value = game?.description || '';

    // 设置分类
    if (game?.category) {
      document.getElementById('gameCategory').value = game.category;
    }

    // 设置评分
    UI.renderRatingStars(game?.rating || 0, true);

    document.getElementById('addGameModal').classList.add('active');
    document.getElementById('gameTitle').focus();
  },

  closeAddModal() {
    document.getElementById('addGameModal').classList.remove('active');
    App.editMode = false;
  },

  async saveGame() {
    const ratingStars = document.querySelectorAll('#ratingInput .star.active');
    const rating = ratingStars.length;

    const data = {
      title: document.getElementById('gameTitle').value.trim(),
      executable_path: document.getElementById('gameExePath').value.trim(),
      developer: document.getElementById('gameDeveloper').value.trim(),
      publisher: document.getElementById('gamePublisher').value.trim(),
      release_year: document.getElementById('gameYear').value.trim(),
      category: document.getElementById('gameCategory').value,
      tags: document.getElementById('gameTags').value.trim(),
      description: document.getElementById('gameDescription').value.trim(),
      rating,
    };

    if (!data.title) {
      Utils.showToast('请输入游戏名称', 'warning');
      return;
    }

    try {
      // 保存当前状态（closeAddModal 会重置 editMode）
      const wasEditing = App.editMode;
      const editingGameId = App.selectedGame?.id;

      if (wasEditing && editingGameId) {
        await API.updateGame(editingGameId, data);
        Utils.showToast(`"${data.title}" 已更新`, 'success');
      } else {
        await API.createGame(data);
        Utils.showToast(`"${data.title}" 已导入`, 'success');
      }

      App.closeAddModal();
      await App.loadGames();

      // 如果是在编辑模式，刷新详情面板
      if (wasEditing && editingGameId) {
        App.showDetail(editingGameId);
      }
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  // ========== 游戏详情 ==========

  async showDetail(id) {
    try {
      const [game, sessions] = await Promise.all([
        API.getGame(id),
        API.getSessions(id),
      ]);

      App.selectedGame = game;
      UI.renderDetail(game, sessions);

      // 更新运行状态
      const status = await API.getGameStatus(id);
      App.updateDetailRunState(status);

      document.getElementById('detailOverlay').classList.add('active');
    } catch (err) {
      Utils.showToast('加载游戏详情失败', 'error');
    }
  },

  closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    App.selectedGame = null;
    App.editMode = false;
  },

  updateDetailRunState(status) {
    const launchBtn = document.getElementById('btnLaunch');
    const stopBtn = document.getElementById('btnStop');

    if (status.running) {
      launchBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';

      // 显示追踪模式和状态
      const modeText = status.mode === 'auto' ? '自动追踪' : '手动计时';
      const pausedText = status.paused ? ' (已暂停)' : '';

      stopBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
        停止游戏 (${Utils.formatElapsed(status.elapsed)})
        <span style="font-size:0.7em;opacity:0.7;margin-left:4px;">${modeText}${pausedText}</span>
      `;
    } else {
      launchBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
    }
  },

  // ========== 游戏操作 ==========

  async quickLaunch(id) {
    try {
      const result = await API.launchGame(id);
      Utils.showToast(result.message, 'success');
      App.runningGames.set(id, { elapsed: 0, mode: result.mode });
      App.loadGames();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async launchGame() {
    if (!App.selectedGame) return;
    try {
      const result = await API.launchGame(App.selectedGame.id);
      Utils.showToast(result.message, 'success');
      App.runningGames.set(App.selectedGame.id, { elapsed: 0, mode: result.mode });
      App.updateDetailRunState({ running: true, elapsed: 0, mode: result.mode });
      App.loadGames();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async stopGame() {
    if (!App.selectedGame) return;
    try {
      const result = await API.stopGame(App.selectedGame.id);
      Utils.showToast(`${result.message}，本次时长: ${Utils.formatDuration(result.duration)}`, 'info');
      App.runningGames.delete(App.selectedGame.id);
      App.updateDetailRunState({ running: false });
      await App.loadGames();
      // 刷新详情
      App.showDetail(App.selectedGame.id);
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async toggleFavorite(id) {
    const game = App.games.find(g => g.id === id);
    if (!game) return;

    try {
      await API.updateGame(id, { is_favorite: game.is_favorite ? 0 : 1 });
      await App.loadGames();
    } catch (err) {
      Utils.showToast('操作失败', 'error');
    }
  },

  async toggleFavoriteFromDetail() {
    if (!App.selectedGame) return;
    const newVal = App.selectedGame.is_favorite ? 0 : 1;
    try {
      await API.updateGame(App.selectedGame.id, { is_favorite: newVal });
      App.selectedGame.is_favorite = newVal;
      document.getElementById('btnFavorite').classList.toggle('active', !!newVal);
      await App.loadGames();
    } catch (err) {
      Utils.showToast('操作失败', 'error');
    }
  },

  editFromDetail() {
    if (!App.selectedGame) return;
    App.showAddModal(App.selectedGame);
  },

  async deleteFromDetail() {
    if (!App.selectedGame) return;
    const confirmed = await Utils.confirm(
      '删除游戏',
      `确定要删除 "${App.selectedGame.title}" 吗？此操作不可撤销。`
    );

    if (!confirmed) return;

    try {
      await API.deleteGame(App.selectedGame.id);
      Utils.showToast(`"${App.selectedGame.title}" 已删除`, 'success');
      App.closeDetail();
      await App.loadGames();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  // ========== 封面上传 ==========

  async uploadCover(file) {
    if (!App.selectedGame) return;

    try {
      const result = await API.uploadCover(App.selectedGame.id, file);
      document.getElementById('detailCover').src = result.cover_image;
      App.selectedGame.cover_image = result.cover_image;
      await App.loadGames();
      Utils.showToast('封面已更新', 'success');
    } catch (err) {
      Utils.showToast('封面上传失败: ' + err.message, 'error');
    }
  },

  async uploadCoverFromPath(filePath) {
    if (!App.selectedGame) return;

    try {
      // 通过 IPC 读取文件内容
      const fileData = await window.electronAPI.readFileAsBase64(filePath);
      if (!fileData) {
        Utils.showToast('无法读取文件', 'error');
        return;
      }

      // 将 base64 转换为 Blob
      const byteCharacters = atob(fileData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileData.mimeType });

      // 创建 File 对象
      const file = new File([blob], fileData.fileName, { type: fileData.mimeType });

      // 上传
      const result = await API.uploadCover(App.selectedGame.id, file);
      document.getElementById('detailCover').src = result.cover_image;
      App.selectedGame.cover_image = result.cover_image;
      await App.loadGames();
      Utils.showToast('封面已更新', 'success');
    } catch (err) {
      Utils.showToast('封面上传失败: ' + err.message, 'error');
    }
  },

  // ========== 备注和标签保存 ==========

  async saveNotesAndTags() {
    if (!App.selectedGame) return;

    const notes = document.getElementById('detailNotes').value;
    const tags = document.getElementById('detailTags').value;

    if (notes !== (App.selectedGame.notes || '') || tags !== (App.selectedGame.tags || '')) {
      try {
        await API.updateGame(App.selectedGame.id, { notes, tags });
        App.selectedGame.notes = notes;
        App.selectedGame.tags = tags;
      } catch (err) {
        console.error('保存失败:', err);
      }
    }
  },

  // ========== 统计面板 ==========

  async showStats() {
    try {
      const stats = await API.getStats();
      UI.renderStats(stats);
      document.getElementById('statsModal').classList.add('active');
    } catch (err) {
      Utils.showToast('加载统计数据失败', 'error');
    }
  },

  closeStatsModal() {
    document.getElementById('statsModal').classList.remove('active');
  },

  // ========== 设置面板 ==========

  showSettingsModal() {
    // 填充当前设置
    document.getElementById('settingExitBehavior').value = App.settings.exitBehavior || 'minimize';
    document.getElementById('settingDefaultView').value = App.settings.defaultView || 'grid';
    document.getElementById('settingAutoLaunch').checked = App.settings.autoLaunch || false;

    // 设置当前主题色
    const currentColor = App.settings.accentColor || '#6c5ce7';
    document.querySelectorAll('.color-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === currentColor);
    });

    document.getElementById('settingsModal').classList.add('active');
  },

  closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
  },

  async saveSettings() {
    const selectedColor = document.querySelector('.color-option.active');

    const newSettings = {
      exitBehavior: document.getElementById('settingExitBehavior').value,
      defaultView: document.getElementById('settingDefaultView').value,
      autoLaunch: document.getElementById('settingAutoLaunch').checked,
      accentColor: selectedColor ? selectedColor.dataset.color : '#6c5ce7',
    };

    try {
      App.settings = await API.updateSettings(newSettings);
      App.applySettings();

      // 通知主进程设置已更新（用于退出行为等）
      if (window.electronAPI) {
        window.electronAPI.updateSettings(newSettings);
      }

      App.closeSettingsModal();
      Utils.showToast('设置已保存', 'success');
    } catch (err) {
      Utils.showToast('保存设置失败', 'error');
    }
  },

  // ========== 状态轮询 ==========

  startStatusPolling() {
    // 每秒更新运行中游戏的计时（本地计时）
    setInterval(() => {
      for (const [gameId, info] of App.runningGames) {
        App.runningGames.set(gameId, { ...info, elapsed: info.elapsed + 1 });
      }

      // 更新卡片上的运行时间显示
      document.querySelectorAll('.game-card-running').forEach(el => {
        const card = el.closest('.game-card');
        const id = parseInt(card.dataset.id);
        const info = App.runningGames.get(id);
        if (info) {
          const modeIcon = info.mode === 'auto' ? '🔄' : '👁️';
          el.innerHTML = `<span class="pulse-dot"></span>运行中 ${Utils.formatElapsed(info.elapsed)} ${modeIcon}`;
        } else {
          // 游戏已停止，移除运行状态显示
          el.remove();
        }
      });

      // 更新详情面板中的停止按钮时间
      if (App.selectedGame && App.runningGames.has(App.selectedGame.id)) {
        const info = App.runningGames.get(App.selectedGame.id);
        const stopBtn = document.getElementById('btnStop');
        if (stopBtn && stopBtn.style.display !== 'none') {
          const modeText = info.mode === 'auto' ? '自动追踪' : '手动计时';
          stopBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
            停止游戏 (${Utils.formatElapsed(info.elapsed)})
            <span style="font-size:0.7em;opacity:0.7;margin-left:4px;">${modeText}</span>
          `;
        }
      }

      // 更新活跃指示器
      const indicator = document.getElementById('activeIndicator');
      const count = App.runningGames.size;
      if (count > 0) {
        indicator.style.display = 'flex';
        document.getElementById('activeCount').textContent = count;
      } else {
        indicator.style.display = 'none';
      }
    }, 1000);

    // 每5秒同步一次服务器状态
    setInterval(async () => {
      try {
        const active = await API.getActiveGames();
        const serverIds = new Set(active.map(g => g.id));
        let changed = false;

        // 同步服务器端状态
        for (const game of active) {
          if (!App.runningGames.has(game.id)) {
            App.runningGames.set(game.id, { elapsed: game.elapsed, mode: game.mode });
            changed = true;
          }
        }

        // 清理已结束的游戏
        for (const [id] of App.runningGames) {
          if (!serverIds.has(id)) {
            App.runningGames.delete(id);
            changed = true;

            // 如果详情面板显示的是刚停止的游戏，刷新详情
            if (App.selectedGame && App.selectedGame.id === id) {
              App.showDetail(id);
            }
          }
        }

        // 如果有变化，刷新游戏列表（更新时长）
        if (changed) {
          App.loadGames();
        }
      } catch (err) {
        // 静默失败
      }
    }, 5000);
  },
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(err => {
    console.error('应用初始化失败:', err);
    Utils.showToast('应用初始化失败，请刷新页面', 'error');
  });
});
