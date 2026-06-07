/* ============================================================
   GameVault - UI 组件和交互
   ============================================================ */

const UI = {
  // 渲染游戏卡片
  renderGameCard(game) {
    const coverUrl = Utils.getCoverUrl(game);
    const runningInfo = App.runningGames.get(game.id);
    const isRunning = !!runningInfo;
    const elapsed = isRunning ? runningInfo.elapsed : 0;
    const mode = isRunning ? runningInfo.mode : null;

    return `
      <div class="game-card fade-in" data-id="${game.id}" onclick="App.showDetail(${game.id})">
        ${isRunning ? `
          <div class="game-card-running">
            <span class="pulse-dot"></span>
            运行中 ${Utils.formatElapsed(elapsed)}
            ${mode === 'auto' ? '🔄' : '👁️'}
          </div>
        ` : ''}
        <div class="game-card-cover">
          ${game.cover_image
            ? `<img src="${coverUrl}" alt="${game.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'default-cover\\'>🎮</div>'">`
            : `<div class="default-cover" style="background:linear-gradient(135deg,${Utils._getGradient(game.title)})">${game.title.charAt(0)}</div>`
          }
          <div class="game-card-overlay">
            <div class="game-card-actions">
              <button class="btn-icon" onclick="event.stopPropagation();App.quickLaunch(${game.id})" title="启动">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <button class="btn-icon" onclick="event.stopPropagation();App.toggleFavorite(${game.id})" title="收藏">
                <svg viewBox="0 0 24 24" fill="${game.is_favorite ? 'var(--warning)' : 'none'}" stroke="${game.is_favorite ? 'var(--warning)' : 'currentColor'}" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="game-card-info">
          <div class="game-card-title" title="${game.title}">${game.title}</div>
          <div class="game-card-meta">
            <span class="game-card-playtime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              ${Utils.formatDurationShort(game.total_playtime)}
            </span>
            ${game.is_favorite ? '<span class="game-card-favorite">⭐</span>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  // 渲染游戏网格
  renderGamesGrid(games) {
    const grid = document.getElementById('gamesGrid');
    const empty = document.getElementById('emptyState');
    const count = document.getElementById('gameCount');

    if (games.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      count.textContent = '0 款游戏';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';
    count.textContent = `${games.length} 款游戏`;

    grid.innerHTML = games.map(g => UI.renderGameCard(g)).join('');
  },

  // 渲染侧边栏分类
  renderSidebar(categories, games) {
    const nav = document.getElementById('sidebarNav');

    // 计算每个分类的游戏数量
    const counts = { '全部游戏': games.length, '收藏夹': 0, '最近游玩': 0 };
    games.forEach(g => {
      if (g.is_favorite) counts['收藏夹']++;
      if (g.last_played) counts['最近游玩']++;
      counts[g.category] = (counts[g.category] || 0) + 1;
    });

    nav.innerHTML = categories.map(cat => `
      <button class="nav-item ${App.currentCategory === cat.name ? 'active' : ''}"
              data-category="${cat.name}" onclick="App.setCategory('${cat.name}')">
        <span class="nav-icon">${cat.icon}</span>
        <span>${cat.name}</span>
        <span class="nav-count">${counts[cat.name] || 0}</span>
        ${cat.id >= 14 ? `<span class="nav-delete" onclick="event.stopPropagation();App.deleteCategory(${cat.id},'${cat.name}')" title="删除分类">×</span>` : ''}
      </button>
    `).join('');
  },

  // 渲染详情面板
  renderDetail(game, sessions) {
    document.getElementById('detailCover').src = Utils.getCoverUrl(game);
    document.getElementById('detailTitle').textContent = game.title;
    document.getElementById('detailCategory').textContent = game.category || '未分类';
    document.getElementById('detailDeveloper').textContent = game.developer || '未知开发商';
    document.getElementById('detailYear').textContent = game.release_year || '';
    document.getElementById('detailPlaytime').textContent = Utils.formatDuration(game.total_playtime);
    document.getElementById('detailSessions').textContent = sessions.length;
    document.getElementById('detailLastPlayed').textContent = Utils.formatDate(game.last_played);
    document.getElementById('detailDesc').textContent = game.description || '暂无简介';
    document.getElementById('detailNotes').value = game.notes || '';
    document.getElementById('detailTags').value = game.tags || '';

    // 收藏按钮
    const favBtn = document.getElementById('btnFavorite');
    favBtn.classList.toggle('active', !!game.is_favorite);

    // 评分星星
    UI.renderRatingStars(game.rating || 0, false);

    // 游玩记录
    const sessionsList = document.getElementById('sessionsList');
    if (sessions.length === 0) {
      sessionsList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">暂无游玩记录</p>';
    } else {
      sessionsList.innerHTML = sessions.slice(0, 10).map(s => `
        <div class="session-item">
          <span class="session-date">${Utils.formatFullDate(s.start_time)}</span>
          <span class="session-duration">${Utils.formatDuration(s.duration)}</span>
        </div>
      `).join('');
    }
  },

  // 渲染评分星星
  renderRatingStars(rating, interactive = false) {
    const container = interactive ? document.getElementById('ratingInput') : document.getElementById('ratingStars');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = `star ${i <= rating ? 'active' : ''}`;
      star.textContent = '★';
      star.dataset.value = i;
      if (interactive) {
        star.addEventListener('click', () => {
          UI.renderRatingStars(i, true);
        });
      }
      container.appendChild(star);
    }
  },

  // 渲染统计面板
  renderStats(stats) {
    // 概览卡片
    document.getElementById('statsOverview').innerHTML = `
      <div class="stats-card">
        <div class="stats-card-value">${stats.totalGames}</div>
        <div class="stats-card-label">游戏总数</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-value">${Utils.formatDurationShort(stats.totalPlaytime)}</div>
        <div class="stats-card-label">总游玩时长</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-value">${stats.favoriteCount}</div>
        <div class="stats-card-label">收藏游戏</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-value">${stats.activeCount}</div>
        <div class="stats-card-label">运行中</div>
      </div>
    `;

    // 时长排行
    const topList = document.getElementById('topGamesList');
    if (stats.topGames.length === 0) {
      topList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">暂无游玩数据</p>';
    } else {
      topList.innerHTML = stats.topGames.map((g, i) => `
        <div class="top-game-item">
          <span class="top-game-rank">${i + 1}</span>
          <img class="top-game-cover" src="${Utils.getCoverUrl(g)}" alt="" onerror="this.style.display='none'">
          <div class="top-game-info">
            <div class="top-game-title">${g.title}</div>
          </div>
          <span class="top-game-time">${Utils.formatDuration(g.total_playtime)}</span>
        </div>
      `).join('');
    }

    // 分类统计
    const catList = document.getElementById('categoryStatsList');
    const maxPlaytime = Math.max(...stats.categoryStats.map(c => c.playtime), 1);
    catList.innerHTML = stats.categoryStats.map(c => `
      <div class="category-stat-item">
        <span class="category-stat-name">${c.category}</span>
        <div class="category-stat-bar">
          <div class="category-stat-fill" style="width:${(c.playtime / maxPlaytime * 100)}%"></div>
        </div>
        <span class="category-stat-count">${c.count}</span>
      </div>
    `).join('');

    // 最近会话
    const recentList = document.getElementById('recentSessionsList');
    if (stats.recentSessions.length === 0) {
      recentList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">暂无游玩记录</p>';
    } else {
      recentList.innerHTML = stats.recentSessions.slice(0, 10).map(s => `
        <div class="recent-session-item">
          <span class="recent-session-title">${s.title}</span>
          <span class="recent-session-date">${Utils.formatDate(s.start_time)}</span>
          <span class="recent-session-duration">${Utils.formatDuration(s.duration)}</span>
        </div>
      `).join('');
    }
  },

  // 渲染分类下拉菜单
  renderCategorySelect(categories) {
    const select = document.getElementById('gameCategory');
    const filtered = categories.filter(c => !['全部游戏', '收藏夹', '最近游玩'].includes(c.name));
    select.innerHTML = filtered.map(c =>
      `<option value="${c.name}">${c.icon} ${c.name}</option>`
    ).join('');
  },

  // 切换视图模式
  setViewMode(mode) {
    const grid = document.getElementById('gamesGrid');
    const gridBtn = document.getElementById('btnGridView');
    const listBtn = document.getElementById('btnListView');

    if (mode === 'list') {
      grid.classList.add('list-view');
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
    } else {
      grid.classList.remove('list-view');
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
    }
  },
};

// 辅助函数：获取渐变色
Utils._getGradient = function (title) {
  const colors = [
    '#6c5ce7,#a29bfe', '#00b894,#55efc4', '#e17055,#fab1a0',
    '#0984e3,#74b9ff', '#fdcb6e,#ffeaa7', '#d63031,#ff7675',
    '#e84393,#fd79a8', '#00cec9,#81ecec',
  ];
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
