/* ============================================================
   GameVault - API 调用封装
   ============================================================ */

const API = {
  BASE: '/api',

  async request(url, options = {}) {
    try {
      const res = await fetch(`${this.BASE}${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      console.error(`API Error [${url}]:`, err);
      throw err;
    }
  },

  // 游戏 CRUD
  async getGames(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/games${query ? '?' + query : ''}`);
  },

  async getGame(id) {
    return this.request(`/games/${id}`);
  },

  async createGame(data) {
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateGame(id, data) {
    return this.request(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteGame(id) {
    return this.request(`/games/${id}`, { method: 'DELETE' });
  },

  // 封面上传
  async uploadCover(id, file) {
    const formData = new FormData();
    formData.append('cover', file);
    const res = await fetch(`${this.BASE}/games/${id}/cover`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '上传失败' }));
      throw new Error(err.error);
    }
    return res.json();
  },

  // 游戏启动/停止
  async launchGame(id) {
    return this.request(`/games/${id}/launch`, { method: 'POST' });
  },

  async stopGame(id) {
    return this.request(`/games/${id}/stop`, { method: 'POST' });
  },

  async getGameStatus(id) {
    return this.request(`/games/${id}/status`);
  },

  async getActiveGames() {
    return this.request('/active');
  },

  // 游玩会话
  async getSessions(gameId) {
    return this.request(`/games/${gameId}/sessions`);
  },

  // 分类
  async getCategories() {
    return this.request('/categories');
  },

  async createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, { method: 'DELETE' });
  },

  // 统计
  async getStats() {
    return this.request('/stats');
  },

  // 设置
  async getSettings() {
    return this.request('/settings');
  },

  async updateSettings(data) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
