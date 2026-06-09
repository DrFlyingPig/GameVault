/* ============================================================
   GameVault - 工具函数
   ============================================================ */

const Utils = {
  // 格式化时长（秒 -> 可读字符串）
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0 分钟';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
    }
    return `${minutes} 分钟`;
  },

  // 格式化短时长（用于卡片）
  formatDurationShort(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  },

  // 格式化实时计时
  formatElapsed(seconds) {
    const totalSeconds = Math.floor(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // 今天
    if (date.toDateString() === now.toDateString()) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    }

    // 更早
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  // 格式化完整日期
  formatFullDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  // 防抖
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 生成默认封面 SVG
  generateDefaultCover(title) {
    const colors = [
      ['#6c5ce7', '#a29bfe'],
      ['#00b894', '#55efc4'],
      ['#e17055', '#fab1a0'],
      ['#0984e3', '#74b9ff'],
      ['#fdcb6e', '#ffeaa7'],
      ['#d63031', '#ff7675'],
      ['#e84393', '#fd79a8'],
      ['#00cec9', '#81ecec'],
    ];
    const hash = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const [c1, c2] = colors[hash % colors.length];
    const initial = title.charAt(0).toUpperCase();

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="300" height="400" fill="url(#g)"/>
        <text x="150" y="180" text-anchor="middle" fill="white" font-size="80" font-weight="bold" font-family="sans-serif" opacity="0.9">${initial}</text>
        <text x="150" y="240" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif" opacity="0.6">GAME</text>
      </svg>
    `)}`;
  },

  // 获取封面 URL
  getCoverUrl(game) {
    if (game.cover_image) return game.cover_image;
    return Utils.generateDefaultCover(game.title);
  },

  // 显示 toast 通知
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // 确认对话框
  confirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      modal.classList.add('active');

      const onOk = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        document.getElementById('confirmOk').removeEventListener('click', onOk);
        document.getElementById('confirmCancel').removeEventListener('click', onCancel);
      };

      document.getElementById('confirmOk').addEventListener('click', onOk);
      document.getElementById('confirmCancel').addEventListener('click', onCancel);
    });
  },
};
