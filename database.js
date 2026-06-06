const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'gamevault.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 默认设置
const DEFAULT_SETTINGS = {
  exitBehavior: 'minimize',    // 'minimize' | 'exit'
  defaultView: 'grid',         // 'grid' | 'list'
  autoLaunch: false,           // 开机自启动
  accentColor: '#6c5ce7',      // 主题色
  minimizeToTray: true,        // 关闭时最小化到托盘
};

// 默认数据
const DEFAULT_DATA = {
  games: [],
  play_sessions: [],
  settings: { ...DEFAULT_SETTINGS },
  categories: [
    { id: 1, name: '全部游戏', icon: '🎮', sort_order: 0 },
    { id: 2, name: '收藏夹', icon: '⭐', sort_order: 1 },
    { id: 3, name: '最近游玩', icon: '🕐', sort_order: 2 },
    { id: 4, name: '动作', icon: '⚔️', sort_order: 3 },
    { id: 5, name: '冒险', icon: '🗺️', sort_order: 4 },
    { id: 6, name: '角色扮演', icon: '🧙', sort_order: 5 },
    { id: 7, name: '射击', icon: '🔫', sort_order: 6 },
    { id: 8, name: '策略', icon: '♟️', sort_order: 7 },
    { id: 9, name: '模拟', icon: '🏗️', sort_order: 8 },
    { id: 10, name: '体育', icon: '⚽', sort_order: 9 },
    { id: 11, name: '竞速', icon: '🏎️', sort_order: 10 },
    { id: 12, name: '独立', icon: '💎', sort_order: 11 },
    { id: 13, name: '休闲', icon: '🎯', sort_order: 12 },
  ],
  next_game_id: 1,
  next_session_id: 1,
  next_category_id: 14,
};

class JsonDB {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return { ...DEFAULT_DATA, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('数据库加载失败，使用默认数据:', err.message);
    }
    return { ...DEFAULT_DATA };
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('数据库保存失败:', err.message);
    }
  }

  // ========== 游戏操作 ==========

  getGames({ search, category, sort, favorites } = {}) {
    let games = [...this.data.games];

    if (search) {
      const kw = search.toLowerCase();
      games = games.filter(g =>
        g.title.toLowerCase().includes(kw) ||
        g.developer.toLowerCase().includes(kw) ||
        g.publisher.toLowerCase().includes(kw) ||
        g.tags.toLowerCase().includes(kw)
      );
    }

    if (favorites === '1') {
      games = games.filter(g => g.is_favorite === 1);
    } else if (category && category !== '全部游戏' && category !== '最近游玩') {
      games = games.filter(g => g.category === category);
    }

    if (category === '最近游玩') {
      games = games.filter(g => g.last_played);
      games.sort((a, b) => new Date(b.last_played) - new Date(a.last_played));
    } else {
      switch (sort) {
        case 'title': games.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'playtime': games.sort((a, b) => b.total_playtime - a.total_playtime); break;
        case 'recent': games.sort((a, b) => new Date(b.last_played || 0) - new Date(a.last_played || 0)); break;
        case 'rating': games.sort((a, b) => b.rating - a.rating); break;
        default: games.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    }

    return games;
  }

  getGame(id) {
    return this.data.games.find(g => g.id === id) || null;
  }

  createGame(data) {
    const game = {
      id: this.data.next_game_id++,
      title: data.title || '',
      executable_path: data.executable_path || '',
      cover_image: data.cover_image || null,
      description: data.description || '',
      developer: data.developer || '',
      publisher: data.publisher || '',
      release_year: data.release_year || '',
      category: data.category || '未分类',
      is_favorite: data.is_favorite || 0,
      total_playtime: 0,
      last_played: null,
      rating: data.rating || 0,
      notes: data.notes || '',
      tags: data.tags || '',
      created_at: new Date().toISOString(),
    };
    this.data.games.push(game);
    this.save();
    return game;
  }

  updateGame(id, updates) {
    const game = this.getGame(id);
    if (!game) return null;

    const fields = ['title', 'executable_path', 'description', 'developer', 'publisher',
      'release_year', 'category', 'is_favorite', 'rating', 'notes', 'tags', 'cover_image'];
    for (const field of fields) {
      if (updates[field] !== undefined) {
        game[field] = updates[field];
      }
    }
    this.save();
    return game;
  }

  deleteGame(id) {
    const idx = this.data.games.findIndex(g => g.id === id);
    if (idx === -1) return false;
    this.data.games.splice(idx, 1);
    this.data.play_sessions = this.data.play_sessions.filter(s => s.game_id !== id);
    this.save();
    return true;
  }

  addPlaytime(gameId, seconds) {
    const game = this.getGame(gameId);
    if (!game) return;
    game.total_playtime += seconds;
    this.save();
  }

  setLastPlayed(gameId) {
    const game = this.getGame(gameId);
    if (!game) return;
    game.last_played = new Date().toISOString();
    this.save();
  }

  // ========== 会话操作 ==========

  createSession(gameId) {
    const session = {
      id: this.data.next_session_id++,
      game_id: gameId,
      start_time: new Date().toISOString(),
      end_time: null,
      duration: 0,
    };
    this.data.play_sessions.push(session);
    this.save();
    return session;
  }

  endSession(sessionId, duration) {
    const session = this.data.play_sessions.find(s => s.id === sessionId);
    if (!session) return null;
    session.end_time = new Date().toISOString();
    session.duration = duration;
    this.save();
    return session;
  }

  getSessions(gameId) {
    return this.data.play_sessions
      .filter(s => s.game_id === gameId)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }

  getRecentSessions(limit = 20) {
    return this.data.play_sessions
      .filter(s => s.end_time)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, limit)
      .map(s => {
        const game = this.getGame(s.game_id);
        return { ...s, title: game?.title || '未知', cover_image: game?.cover_image };
      });
  }

  // ========== 分类操作 ==========

  getCategories() {
    return [...this.data.categories].sort((a, b) => a.sort_order - b.sort_order);
  }

  createCategory(name, icon = '📁') {
    if (this.data.categories.find(c => c.name === name)) return null;
    const maxOrder = Math.max(...this.data.categories.map(c => c.sort_order), 0);
    const cat = {
      id: this.data.next_category_id++,
      name,
      icon,
      sort_order: maxOrder + 1,
    };
    this.data.categories.push(cat);
    this.save();
    return cat;
  }

  deleteCategory(id) {
    const idx = this.data.categories.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const cat = this.data.categories[idx];
    if (['全部游戏', '收藏夹', '最近游玩'].includes(cat.name)) return false;
    this.data.categories.splice(idx, 1);
    this.save();
    return true;
  }

  // ========== 设置操作 ==========

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.data.settings };
  }

  updateSettings(updates) {
    this.data.settings = { ...this.getSettings(), ...updates };
    this.save();
    return this.data.settings;
  }

  // ========== 统计 ==========

  getStats() {
    const games = this.data.games;
    const totalGames = games.length;
    const totalPlaytime = games.reduce((sum, g) => sum + g.total_playtime, 0);
    const favoriteCount = games.filter(g => g.is_favorite === 1).length;

    const topGames = games
      .filter(g => g.total_playtime > 0)
      .sort((a, b) => b.total_playtime - a.total_playtime)
      .slice(0, 10)
      .map(g => ({ id: g.id, title: g.title, cover_image: g.cover_image, total_playtime: g.total_playtime }));

    const categoryMap = {};
    games.forEach(g => {
      if (!categoryMap[g.category]) categoryMap[g.category] = { count: 0, playtime: 0 };
      categoryMap[g.category].count++;
      categoryMap[g.category].playtime += g.total_playtime;
    });
    const categoryStats = Object.entries(categoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.playtime - a.playtime);

    return {
      totalGames,
      totalPlaytime,
      favoriteCount,
      topGames,
      recentSessions: this.getRecentSessions(),
      categoryStats,
      weeklyTrend: [],
    };
  }
}

module.exports = new JsonDB();
