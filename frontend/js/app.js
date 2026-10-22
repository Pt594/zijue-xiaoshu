// ========== 自觉小树 前端逻辑 ==========
const API = '';  // 同源，部署时同源即可

let state = {
  token: localStorage.getItem('zijue_token') || null,
  user: null,
  goals: [],
  contents: [],
  currentView: 'timer',
  timer: {
    totalSeconds: 25 * 60,
    remaining: 25 * 60,
    interval: null,
    running: false,
    paused: false
  }
};

// ========== API 封装 ==========
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

// ========== 工具 ==========
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showPage(id) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function showReward(title, message, badges = []) {
  $('#reward-title').textContent = title;
  $('#reward-message').textContent = message;
  $('#reward-icon').textContent = badges.length ? '🏆' : '⭐';
  const badgesEl = $('#reward-badges');
  badgesEl.innerHTML = badges.map(b => 
    `<div class="reward-badge-item">${b.icon} ${b.name}</div>`
  ).join('');
  $('#reward-modal').classList.remove('hidden');
}

function treeEmoji(level) {
  if (level <= 1) return '🌱';
  if (level <= 3) return '🌿';
  if (level <= 5) return '🌳';
  if (level <= 8) return '🌲';
  if (level <= 12) return '🌴';
  return '🎄';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// ========== 认证 ==========
async function login(username, password) {
  const data = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('zijue_token', data.token);
  await enterApp();
}

async function register(formData) {
  const data = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('zijue_token', data.token);
  await enterApp();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('zijue_token');
  showPage('auth-page');
  if (state.timer.interval) clearInterval(state.timer.interval);
}

async function loadMe() {
  const user = await api('/api/me');
  state.user = user;
  return user;
}

async function enterApp() {
  try {
    await loadMe();
    showPage('app-page');
    updateHeader();
    
    if (state.user.role === 'child') {
      $('#child-dashboard').classList.remove('hidden');
      $('#parent-dashboard').classList.add('hidden');
      updateGrowthCard();
      switchView('timer');
      loadGoals();
      loadCheckins();
      loadContents();
      loadBadges();
    } else {
      $('#child-dashboard').classList.add('hidden');
      $('#parent-dashboard').classList.remove('hidden');
      loadChildren();
    }
  } catch (e) {
    logout();
  }
}

function updateHeader() {
  $('#user-avatar').textContent = state.user.avatar || '🌱';
  $('#user-name').textContent = state.user.display_name || state.user.username;
}

function updateGrowthCard() {
  const level = state.user.level || 1;
  const stars = state.user.stars || 0;
  $('#user-level').textContent = level;
  $('#user-stars').textContent = stars;
  $('#user-minutes').textContent = state.user.total_study_minutes || 0;
  $('#tree-visual').textContent = treeEmoji(level);
  
  // 进度：每级需要10星
  const starsInLevel = stars % 10;
  const percent = (starsInLevel / 10) * 100;
  $('#level-progress').style.width = `${percent}%`;
  const need = 10 - starsInLevel;
  $('#progress-tip').textContent = need === 10 && stars > 0 
    ? '恭喜升级！继续加油！' 
    : `再获得 ${need} 颗星星就能升级啦！`;
}

// ========== 视图切换 ==========
function switchView(viewName) {
  state.currentView = viewName;
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${viewName}`)?.classList.remove('hidden');
  $$('.action-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
}

// ========== 番茄钟 ==========
function setTimerDuration(minutes) {
  if (state.timer.running) return;
  state.timer.totalSeconds = minutes * 60;
  state.timer.remaining = minutes * 60;
  $('#timer-display').textContent = formatTime(state.timer.remaining);
}

function startTimer() {
  if (state.timer.running && !state.timer.paused) return;
  
  if (state.timer.paused) {
    state.timer.paused = false;
  } else {
    state.timer.remaining = state.timer.totalSeconds;
  }
  
  state.timer.running = true;
  $('#timer-start').classList.add('hidden');
  $('#timer-pause').classList.remove('hidden');
  $('#timer-reset').classList.remove('hidden');
  
  state.timer.interval = setInterval(() => {
    state.timer.remaining--;
    $('#timer-display').textContent = formatTime(state.timer.remaining);
    
    if (state.timer.remaining <= 0) {
      clearInterval(state.timer.interval);
      state.timer.running = false;
      state.timer.paused = false;
      onTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.timer.running) return;
  clearInterval(state.timer.interval);
  state.timer.paused = true;
  state.timer.running = false;
  $('#timer-start').classList.remove('hidden');
  $('#timer-start').textContent = '继续';
  $('#timer-pause').classList.add('hidden');
}

function resetTimer() {
  clearInterval(state.timer.interval);
  state.timer.running = false;
  state.timer.paused = false;
  state.timer.remaining = state.timer.totalSeconds;
  $('#timer-display').textContent = formatTime(state.timer.remaining);
  $('#timer-start').classList.remove('hidden');
  $('#timer-start').textContent = '开始专注';
  $('#timer-pause').classList.add('hidden');
  $('#timer-reset').classList.add('hidden');
}

async function onTimerComplete() {
  $('#timer-start').classList.remove('hidden');
  $('#timer-start').textContent = '开始专注';
  $('#timer-pause').classList.add('hidden');
  $('#timer-reset').classList.add('hidden');
  
  try {
    const duration = Math.round(state.timer.totalSeconds / 60);
    const data = await api('/api/pomodoro', {
      method: 'POST',
      body: JSON.stringify({ durationMinutes: duration })
    });
    
    state.user.stars = data.user.stars;
    state.user.level = data.user.level;
    state.user.total_study_minutes = data.user.total_study_minutes;
    updateGrowthCard();
    
    showReward(
      '专注完成！',
      `你完成了 ${duration} 分钟专注，获得 1 颗星星！`,
      data.newBadges || []
    );
    
    // 播放提示音（简单beep用Web Audio）
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => osc.stop(), 200);
    } catch(e) {}
  } catch (e) {
    alert(e.message);
  }
}

// ========== 目标 ==========
async function loadGoals() {
  try {
    state.goals = await api('/api/goals');
    renderGoals();
    // 更新打卡下拉
    const select = $('#checkin-goal');
    select.innerHTML = '<option value="">不关联目标</option>' +
      state.goals.filter(g => g.status === 'active').map(g =>
        `<option value="${g.id}">${g.title}</option>`
      ).join('');
  } catch (e) {
    console.error(e);
  }
}

function renderGoals() {
  const container = $('#goals-list');
  if (!state.goals.length) {
    container.innerHTML = '<p class="empty-tip">还没有目标，点击上方按钮设定一个吧！</p>';
    return;
  }
  
  container.innerHTML = state.goals.map(g => {
    const percent = Math.min(100, (g.current_count / g.target_count) * 100);
    return `
      <div class="list-item">
        <div class="list-item-icon">${g.subject === '数学' ? '🔢' : g.subject === '语文' ? '📖' : g.subject === '英语' ? '🗣️' : g.subject === '科学' ? '🔬' : '🎯'}</div>
        <div class="list-item-body">
          <div class="list-item-title">${g.title}</div>
          <div class="list-item-meta">
            <span class="goal-status ${g.status}">${g.status === 'active' ? '进行中' : g.status === 'completed' ? '已完成' : '已放弃'}</span>
            · ${g.subject} · ${g.current_count}/${g.target_count} 次
          </div>
          <div class="goal-progress">
            <div class="goal-progress-bar" style="width:${percent}%"></div>
          </div>
        </div>
        ${g.status === 'active' ? `
          <div class="list-item-action">
            <button class="btn btn-outline" style="padding:6px 10px;font-size:12px" onclick="completeGoal('${g.id}')">完成</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function createGoal(data) {
  await api('/api/goals', { method: 'POST', body: JSON.stringify(data) });
  await loadGoals();
  $('#goal-form-container').classList.add('hidden');
  $('#goal-form').reset();
}

async function completeGoal(id) {
  if (!confirm('确定标记为完成吗？将获得额外星星奖励！')) return;
  try {
    await api(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    await loadMe();
    updateGrowthCard();
    await loadGoals();
    showReward('目标达成！', '太厉害了！你完成了一个学习目标，获得 5 颗星星！');
  } catch (e) {
    alert(e.message);
  }
}

// ========== 打卡 ==========
async function doCheckin(data) {
  const result = await api('/api/checkin', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  state.user.stars = result.user.stars;
  state.user.level = result.user.level;
  state.user.total_study_minutes = result.user.total_study_minutes;
  updateGrowthCard();
  await loadGoals();
  await loadCheckins();
  await loadBadges();
  
  showReward(
    '打卡成功！',
    `获得 ${result.checkin.stars_earned} 颗星星，继续保持！`,
    result.newBadges || []
  );
}

async function loadCheckins() {
  try {
    const checkins = await api('/api/checkins');
    const container = $('#checkin-list');
    if (!checkins.length) {
      container.innerHTML = '<p class="empty-tip">还没有打卡记录</p>';
      return;
    }
    container.innerHTML = checkins.slice(0, 10).map(c => `
      <div class="list-item">
        <div class="list-item-icon">✅</div>
        <div class="list-item-body">
          <div class="list-item-title">${c.goal_title || '自由打卡'}</div>
          <div class="list-item-meta">
            ${formatDate(c.created_at)} · +${c.stars_earned}⭐
            ${c.study_minutes ? ` · ${c.study_minutes}分钟` : ''}
            ${c.note ? ` · ${c.note}` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ========== 学习内容 ==========
async function loadContents() {
  try {
    state.contents = await api('/api/content');
    renderContents('all');
  } catch (e) {
    console.error(e);
  }
}

function renderContents(subject) {
  const list = subject === 'all' 
    ? state.contents 
    : state.contents.filter(c => c.subject === subject);
  
  $('#content-list').innerHTML = list.map(c => `
    <div class="content-card" onclick="openContent('${c.id}')">
      <div class="content-card-icon">${c.icon}</div>
      <div class="content-card-title">${c.title}</div>
      <div class="content-card-meta">${c.subject} · ${c.stars_reward}⭐</div>
    </div>
  `).join('');
}

async function openContent(id) {
  try {
    const content = await api(`/api/content/${id}`);
    $('#content-detail').innerHTML = `
      <div class="content-detail-icon">${content.icon}</div>
      <h3 class="content-detail-title">${content.title}</h3>
      <div class="content-detail-meta">${content.subject} · 难度${content.difficulty} · 完成可得 ${content.stars_reward}⭐</div>
      <div class="content-detail-body">${content.content_body}</div>
      <button class="btn btn-primary btn-block" onclick="completeContent('${content.id}')">✅ 我学完了！</button>
    `;
    $('#content-modal').classList.remove('hidden');
  } catch (e) {
    alert(e.message);
  }
}

async function completeContent(id) {
  try {
    const data = await api(`/api/content/${id}/complete`, { method: 'POST' });
    state.user.stars = data.user.stars;
    state.user.level = data.user.level;
    updateGrowthCard();
    await loadBadges();
    $('#content-modal').classList.add('hidden');
    showReward(
      '学习完成！',
      `太棒了！获得 ${data.stars_earned} 颗星星！`,
      data.newBadges || []
    );
  } catch (e) {
    alert(e.message);
  }
}

// ========== 徽章 ==========
async function loadBadges() {
  try {
    const badges = await api('/api/badges');
    const container = $('#badges-list');
    const empty = $('#badges-empty');
    
    if (!badges.length) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    container.innerHTML = badges.map(b => `
      <div class="badge-card">
        <div class="badge-icon">${b.badge_icon}</div>
        <div class="badge-name">${b.badge_name}</div>
        <div class="badge-date">${formatDate(b.earned_at)}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ========== 家长端 ==========
async function loadChildren() {
  try {
    const children = await api('/api/parent/children');
    const container = $('#children-list');
    
    if (!children.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)">
          <p style="font-size:40px;margin-bottom:12px">🌱</p>
          <p>还没有绑定的孩子</p>
          <p style="font-size:13px;margin-top:8px">让孩子注册时填写你的用户名即可绑定</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = children.map(c => `
      <div class="child-card" onclick="viewChild('${c.id}')">
        <div class="child-card-avatar">${c.avatar || '🌱'}</div>
        <div class="child-card-name">${c.display_name}</div>
        <div class="child-card-stats">
          Lv.${c.level} · ⭐${c.stars}<br>
          学习 ${c.total_study_minutes || 0} 分钟
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function viewChild(childId) {
  try {
    const data = await api(`/api/parent/child/${childId}`);
    $('#children-list').classList.add('hidden');
    $('#child-detail').classList.remove('hidden');
    
    const { child, goals, checkins, badges, pomoCount } = data;
    
    $('#child-detail-content').innerHTML = `
      <div class="detail-section" style="text-align:center">
        <div style="font-size:56px">${child.avatar || treeEmoji(child.level)}</div>
        <h2 style="margin:8px 0">${child.display_name}</h2>
        <p style="color:var(--text-light)">
          Lv.${child.level} · ⭐ ${child.stars} 星星 · ⏱️ ${child.total_study_minutes || 0} 分钟 · 🍅 ${pomoCount} 次专注
        </p>
      </div>
      
      <div class="detail-section">
        <h3>🎯 学习目标</h3>
        ${goals.length ? goals.map(g => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <strong>${g.title}</strong>
            <span class="goal-status ${g.status}" style="margin-left:8px">
              ${g.status === 'active' ? '进行中' : g.status === 'completed' ? '已完成' : '已放弃'}
            </span>
            <div style="font-size:12px;color:var(--text-light);margin-top:4px">
              ${g.subject} · ${g.current_count}/${g.target_count} 次
            </div>
          </div>
        `).join('') : '<p style="color:var(--text-light)">暂无目标</p>'}
      </div>
      
      <div class="detail-section">
        <h3>✅ 最近打卡</h3>
        ${checkins.length ? checkins.slice(0, 10).map(c => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
            ${formatDate(c.created_at)} · ${c.goal_title || '自由打卡'}
            ${c.study_minutes ? ` · ${c.study_minutes}分钟` : ''}
            ${c.note ? `<br><span style="color:var(--text-light);font-size:12px">${c.note}</span>` : ''}
          </div>
        `).join('') : '<p style="color:var(--text-light)">暂无打卡</p>'}
      </div>
      
      <div class="detail-section">
        <h3>🏆 获得徽章</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${badges.length ? badges.map(b => `
            <div style="background:var(--primary-light);padding:8px 12px;border-radius:10px;font-size:13px">
              ${b.badge_icon} ${b.badge_name}
            </div>
          `).join('') : '<p style="color:var(--text-light)">暂无徽章</p>'}
        </div>
      </div>
    `;
  } catch (e) {
    alert(e.message);
  }
}

// ========== 事件绑定 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 认证页切换
  $$('.auth-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      $('#login-form').classList.toggle('hidden', !isLogin);
      $('#register-form').classList.toggle('hidden', isLogin);
    });
  });
  
  // 角色切换时显示/隐藏家长用户名
  $$('input[name="role"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isChild = radio.value === 'child' && radio.checked;
      $('#parent-username-group').style.display = isChild ? 'block' : 'none';
    });
  });
  
  // 登录
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await login($('#login-username').value.trim(), $('#login-password').value);
    } catch (err) {
      alert(err.message);
    }
  });
  
  // 注册
  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked').value;
    try {
      await register({
        username: $('#reg-username').value.trim(),
        password: $('#reg-password').value,
        displayName: $('#reg-displayname').value.trim(),
        role,
        parentUsername: role === 'child' ? $('#reg-parent').value.trim() || undefined : undefined
      });
    } catch (err) {
      alert(err.message);
    }
  });
  
  // 退出
  $('#logout-btn').addEventListener('click', logout);
  
  // 快捷导航
  $$('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  // 番茄钟
  $('#timer-25').addEventListener('click', () => setTimerDuration(25));
  $('#timer-15').addEventListener('click', () => setTimerDuration(15));
  $('#timer-5').addEventListener('click', () => setTimerDuration(5));
  $('#timer-start').addEventListener('click', startTimer);
  $('#timer-pause').addEventListener('click', pauseTimer);
  $('#timer-reset').addEventListener('click', resetTimer);
  
  // 打卡
  $('#checkin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await doCheckin({
        goalId: $('#checkin-goal').value || null,
        note: $('#checkin-note').value.trim(),
        studyMinutes: parseInt($('#checkin-minutes').value) || 0
      });
      $('#checkin-form').reset();
      $('#checkin-minutes').value = 25;
    } catch (err) {
      alert(err.message);
    }
  });
  
  // 目标
  $('#add-goal-btn').addEventListener('click', () => {
    $('#goal-form-container').classList.remove('hidden');
  });
  $('#cancel-goal').addEventListener('click', () => {
    $('#goal-form-container').classList.add('hidden');
  });
  $('#goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await createGoal({
        title: $('#goal-title').value.trim(),
        subject: $('#goal-subject').value,
        targetCount: parseInt($('#goal-target').value) || 7,
        description: $('#goal-desc').value.trim()
      });
    } catch (err) {
      alert(err.message);
    }
  });
  
  // 内容筛选
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContents(btn.dataset.subject);
    });
  });
  
  // 关闭弹窗
  $('#close-content').addEventListener('click', () => {
    $('#content-modal').classList.add('hidden');
  });
  $('#close-reward').addEventListener('click', () => {
    $('#reward-modal').classList.add('hidden');
  });
  $('#back-to-children').addEventListener('click', () => {
    $('#child-detail').classList.add('hidden');
    $('#children-list').classList.remove('hidden');
  });
  
  // 点击模态背景关闭
  $('#content-modal').addEventListener('click', (e) => {
    if (e.target === $('#content-modal')) $('#content-modal').classList.add('hidden');
  });
  $('#reward-modal').addEventListener('click', (e) => {
    if (e.target === $('#reward-modal')) $('#reward-modal').classList.add('hidden');
  });
  
  // 自动登录
  if (state.token) {
    enterApp();
  }
});

// 暴露给 HTML onclick
window.completeGoal = completeGoal;
window.openContent = openContent;
window.completeContent = completeContent;
window.viewChild = viewChild;
