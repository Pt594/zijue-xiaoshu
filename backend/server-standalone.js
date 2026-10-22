/**
 * 自觉小树 - 零依赖纯 Node.js 服务器
 * 使用方法: node server-standalone.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zijue-xiaoshu-secret-2026';
const DB_PATH = path.join(__dirname, 'data.json');
const FRONTEND = path.join(__dirname, '../frontend');

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashVerify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === hashVerify;
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function now() { return new Date().toISOString(); }

const DEFAULT = {
  users: [], goals: [], checkins: [], badges: [], pomodoro_sessions: [],
  content: [
    { id:'c1', title:'认识分数', subject:'数学', description:'学习分数的基本概念和表示方法', content_body:'分数表示整体的一部分。分子在上，分母在下。比如 1/2 表示把一个苹果分成两半，取其中一半。\n\n练习：把一个圆形分成4份，涂色3份，用分数表示是？', difficulty:1, stars_reward:3, icon:'🔢' },
    { id:'c2', title:'古诗《静夜思》', subject:'语文', description:'背诵并理解李白的经典古诗', content_body:'床前明月光，疑是地上霜。\n举头望明月，低头思故乡。\n\n作者：李白\n意思：诗人在安静的夜里看到月光，想起了家乡。', difficulty:1, stars_reward:3, icon:'📜' },
    { id:'c3', title:'动物的栖息地', subject:'科学', description:'了解不同动物生活在什么地方', content_body:'北极熊生活在寒冷的北极，有厚厚的白毛保暖。\n骆驼生活在沙漠，可以很久不喝水。\n熊猫喜欢吃竹子，主要生活在中国四川。\n\n想一想：企鹅住在哪里？', difficulty:1, stars_reward:2, icon:'🐻' },
    { id:'c4', title:'日常英语对话：打招呼', subject:'英语', description:'学习基本的英语问候语', content_body:'Hello! / Hi! 你好！\nGood morning! 早上好！\nHow are you? 你好吗？\nI am fine, thank you. 我很好，谢谢。\nNice to meet you! 很高兴认识你！\n\n试着和家人用英语打招呼吧！', difficulty:1, stars_reward:2, icon:'🗣️' },
    { id:'c5', title:'乘法口诀表（1-5）', subject:'数学', description:'熟练掌握1到5的乘法口诀', content_body:'一一得一\n一二得二 二二得四\n一三得三 二三得六 三三得九\n一四得四 二四得八 三四十二 四四十六\n一五得五 二五一十 三五十五 四五二十 五五二十五\n\n每天背一遍，很快就能记住！', difficulty:2, stars_reward:4, icon:'✖️' },
    { id:'c6', title:'保护环境小知识', subject:'科学', description:'学习如何保护我们的地球', content_body:'1. 节约用水用电\n2. 垃圾分类投放\n3. 少用一次性塑料袋\n4. 多种树，保护森林\n5. 爱护小动物\n\n今天你能为地球做一件什么事？', difficulty:1, stars_reward:2, icon:'🌍' },
    { id:'c7', title:'成语故事：守株待兔', subject:'语文', description:'学习经典成语及其寓意', content_body:'从前有个农夫，看到一只兔子撞死在树桩上，就天天守着树桩等兔子。结果再也没有兔子来，田地也荒了。\n\n寓意：不要把偶然的运气当成必然，要靠自己的努力。', difficulty:2, stars_reward:3, icon:'📖' },
    { id:'c8', title:'认识时间', subject:'数学', description:'学会看时钟，理解时、分、秒', content_body:'时钟有时针（短）和分针（长）。\n时针走一大格是1小时，分针走一圈是60分钟。\n\n练习：现在是3点半，时针指向哪里？分针指向哪里？', difficulty:1, stars_reward:3, icon:'⏰' }
  ]
};

const BADGES = {
  first_checkin: { name:'初次打卡', icon:'🌟' },
  streak_3: { name:'连续3天', icon:'🔥' },
  streak_7: { name:'连续一周', icon:'💪' },
  stars_10: { name:'十星达人', icon:'⭐' },
  stars_50: { name:'五十星勇士', icon:'🌠' },
  level_3: { name:'成长三级', icon:'🌱' },
  level_5: { name:'成长五级', icon:'🌳' },
  pomodoro_5: { name:'专注达人', icon:'🍅' },
  goal_complete: { name:'目标达成', icon:'🎯' }
};

let DB = (() => {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {}
  const d = JSON.parse(JSON.stringify(DEFAULT));
  fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2));
  return d;
})();

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
}

function calcLevel(stars) { return Math.min(20, Math.floor(stars / 10) + 1); }

function awardBadge(userId, key) {
  if (DB.badges.some(b => b.user_id === userId && b.badge_key === key)) return null;
  const def = BADGES[key];
  if (!def) return null;
  DB.badges.push({ id: uuid(), user_id: userId, badge_key: key, badge_name: def.name, badge_icon: def.icon, earned_at: now() });
  save();
  return def;
}

function checkBadges(userId) {
  const user = DB.users.find(u => u.id === userId);
  if (!user) return [];
  const awarded = [];
  if (user.stars >= 10) { const b = awardBadge(userId, 'stars_10'); if (b) awarded.push(b); }
  if (user.stars >= 50) { const b = awardBadge(userId, 'stars_50'); if (b) awarded.push(b); }
  if (user.level >= 3) { const b = awardBadge(userId, 'level_3'); if (b) awarded.push(b); }
  if (user.level >= 5) { const b = awardBadge(userId, 'level_5'); if (b) awarded.push(b); }
  const days = [...new Set(DB.checkins.filter(c => c.user_id === userId).map(c => (c.created_at||'').slice(0,10)))];
  if (days.length >= 3) { const b = awardBadge(userId, 'streak_3'); if (b) awarded.push(b); }
  if (days.length >= 7) { const b = awardBadge(userId, 'streak_7'); if (b) awarded.push(b); }
  if (DB.pomodoro_sessions.filter(p => p.user_id === userId).length >= 5) {
    const b = awardBadge(userId, 'pomodoro_5'); if (b) awarded.push(b);
  }
  if (DB.goals.filter(g => g.user_id === userId && g.status === 'completed').length >= 1) {
    const b = awardBadge(userId, 'goal_complete'); if (b) awarded.push(b);
  }
  return awarded;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  const type = types[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': type + (type.startsWith('text') || type.includes('javascript') || type.includes('json') ? '; charset=utf-8' : '') });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

function getAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return verifyToken(h.slice(7));
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
    });
    return res.end();
  }

  try {
    if (pathname === '/api/register' && method === 'POST') {
      const body = await readBody(req);
      const { username, password, displayName, role, parentUsername } = body;
      if (!username || !password || !displayName || !role) return send(res, 400, { error: '请填写完整信息' });
      if (!['child', 'parent'].includes(role)) return send(res, 400, { error: '角色无效' });
      if (password.length < 4) return send(res, 400, { error: '密码至少4位' });
      if (DB.users.find(u => u.username === username)) return send(res, 400, { error: '用户名已被使用' });
      let parentId = null;
      if (role === 'child' && parentUsername) {
        const p = DB.users.find(u => u.username === parentUsername && u.role === 'parent');
        if (!p) return send(res, 400, { error: '家长账号不存在' });
        parentId = p.id;
      }
      const user = {
        id: uuid(), username, password_hash: hashPassword(password),
        display_name: displayName, role, parent_id: parentId,
        avatar: role === 'child' ? '🌱' : '👨‍👩‍👧',
        stars: 0, level: 1, total_study_minutes: 0, created_at: now()
      };
      DB.users.push(user); save();
      const safe = { id: user.id, username, display_name: displayName, role, avatar: user.avatar, stars: 0, level: 1 };
      return send(res, 200, { token: signToken({ id: user.id, username, role }), user: safe });
    }

    if (pathname === '/api/login' && method === 'POST') {
      const body = await readBody(req);
      const user = DB.users.find(u => u.username === body.username);
      if (!user || !verifyPassword(body.password || '', user.password_hash)) {
        return send(res, 401, { error: '用户名或密码错误' });
      }
      const safe = { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar: user.avatar, stars: user.stars, level: user.level, total_study_minutes: user.total_study_minutes };
      return send(res, 200, { token: signToken({ id: user.id, username: user.username, role: user.role }), user: safe });
    }

    const auth = getAuth(req);
    if (!auth && pathname.startsWith('/api/')) {
      return send(res, 401, { error: '请先登录' });
    }

    if (pathname === '/api/me' && method === 'GET') {
      const user = DB.users.find(u => u.id === auth.id);
      if (!user) return send(res, 404, { error: '用户不存在' });
      const badges = DB.badges.filter(b => b.user_id === user.id);
      return send(res, 200, { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar: user.avatar, stars: user.stars, level: user.level, total_study_minutes: user.total_study_minutes, parent_id: user.parent_id, badges });
    }

    if (pathname === '/api/goals' && method === 'GET') {
      const goals = DB.goals.filter(g => g.user_id === auth.id).sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
      return send(res, 200, goals);
    }
    if (pathname === '/api/goals' && method === 'POST') {
      if (auth.role !== 'child') return send(res, 403, { error: '只有孩子可以设定目标' });
      const body = await readBody(req);
      if (!body.title) return send(res, 400, { error: '请填写目标标题' });
      const goal = { id: uuid(), user_id: auth.id, title: body.title, description: body.description || '', subject: body.subject || '综合', target_count: body.targetCount || 7, current_count: 0, status: 'active', created_at: now(), completed_at: null };
      DB.goals.push(goal); save();
      return send(res, 200, goal);
    }
    if (pathname.startsWith('/api/goals/') && method === 'PATCH') {
      const id = pathname.split('/')[3];
      const goal = DB.goals.find(g => g.id === id && g.user_id === auth.id);
      if (!goal) return send(res, 404, { error: '目标不存在' });
      const body = await readBody(req);
      if (body.status === 'completed') {
        goal.status = 'completed'; goal.completed_at = now();
        const user = DB.users.find(u => u.id === auth.id);
        user.stars += 5; user.level = calcLevel(user.stars);
        awardBadge(auth.id, 'goal_complete');
        save();
      } else if (body.status === 'abandoned') {
        goal.status = 'abandoned'; save();
      }
      return send(res, 200, goal);
    }

    if (pathname === '/api/checkin' && method === 'POST') {
      if (auth.role !== 'child') return send(res, 403, { error: '只有孩子可以打卡' });
      const body = await readBody(req);
      const starsEarned = 1 + ((body.studyMinutes || 0) >= 25 ? 1 : 0);
      const checkin = { id: uuid(), user_id: auth.id, goal_id: body.goalId || null, note: body.note || '', stars_earned: starsEarned, study_minutes: body.studyMinutes || 0, created_at: now() };
      DB.checkins.push(checkin);
      if (body.goalId) {
        const goal = DB.goals.find(g => g.id === body.goalId && g.user_id === auth.id);
        if (goal && goal.status === 'active') {
          goal.current_count += 1;
          if (goal.current_count >= goal.target_count) {
            goal.status = 'completed'; goal.completed_at = now();
            awardBadge(auth.id, 'goal_complete');
          }
        }
      }
      const user = DB.users.find(u => u.id === auth.id);
      user.stars += starsEarned; user.level = calcLevel(user.stars);
      user.total_study_minutes = (user.total_study_minutes || 0) + (body.studyMinutes || 0);
      if (DB.checkins.filter(c => c.user_id === auth.id).length === 1) awardBadge(auth.id, 'first_checkin');
      const newBadges = checkBadges(auth.id);
      save();
      return send(res, 200, { checkin: { id: checkin.id, stars_earned: starsEarned }, user: { stars: user.stars, level: user.level, total_study_minutes: user.total_study_minutes }, newBadges });
    }

    if (pathname === '/api/checkins' && method === 'GET') {
      const list = DB.checkins.filter(c => c.user_id === auth.id).sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0, 50)
        .map(c => ({ ...c, goal_title: c.goal_id ? (DB.goals.find(g => g.id === c.goal_id) || {}).title : null }));
      return send(res, 200, list);
    }

    if (pathname === '/api/pomodoro' && method === 'POST') {
      if (auth.role !== 'child') return send(res, 403, { error: '只有孩子可以使用番茄钟' });
      const body = await readBody(req);
      const duration = body.durationMinutes || 25;
      DB.pomodoro_sessions.push({ id: uuid(), user_id: auth.id, duration_minutes: duration, completed: true, created_at: now() });
      const user = DB.users.find(u => u.id === auth.id);
      user.stars += 1; user.level = calcLevel(user.stars);
      user.total_study_minutes = (user.total_study_minutes || 0) + duration;
      const newBadges = checkBadges(auth.id);
      save();
      return send(res, 200, { session: { duration_minutes: duration }, stars_earned: 1, user: { stars: user.stars, level: user.level, total_study_minutes: user.total_study_minutes }, newBadges });
    }

    if (pathname === '/api/content' && method === 'GET') {
      return send(res, 200, DB.content.map(c => ({ id: c.id, title: c.title, subject: c.subject, description: c.description, difficulty: c.difficulty, stars_reward: c.stars_reward, icon: c.icon })));
    }
    if (pathname.startsWith('/api/content/') && pathname.endsWith('/complete') && method === 'POST') {
      if (auth.role !== 'child') return send(res, 403, { error: '只有孩子可以完成学习' });
      const id = pathname.split('/')[3];
      const content = DB.content.find(c => c.id === id);
      if (!content) return send(res, 404, { error: '内容不存在' });
      const starsAdd = content.stars_reward || 2;
      const user = DB.users.find(u => u.id === auth.id);
      user.stars += starsAdd; user.level = calcLevel(user.stars);
      DB.checkins.push({ id: uuid(), user_id: auth.id, goal_id: null, note: `完成学习：${content.title}`, stars_earned: starsAdd, study_minutes: 10, created_at: now() });
      const newBadges = checkBadges(auth.id);
      save();
      return send(res, 200, { stars_earned: starsAdd, user: { stars: user.stars, level: user.level }, newBadges });
    }
    if (pathname.startsWith('/api/content/') && method === 'GET') {
      const id = pathname.split('/')[3];
      const content = DB.content.find(c => c.id === id);
      if (!content) return send(res, 404, { error: '内容不存在' });
      return send(res, 200, content);
    }

    if (pathname === '/api/parent/children' && method === 'GET') {
      if (auth.role !== 'parent') return send(res, 403, { error: '只有家长可以查看' });
      const children = DB.users.filter(u => u.parent_id === auth.id && u.role === 'child')
        .map(c => ({ id: c.id, username: c.username, display_name: c.display_name, avatar: c.avatar, stars: c.stars, level: c.level, total_study_minutes: c.total_study_minutes, created_at: c.created_at }));
      return send(res, 200, children);
    }
    if (pathname.startsWith('/api/parent/child/') && method === 'GET') {
      if (auth.role !== 'parent') return send(res, 403, { error: '只有家长可以查看' });
      const childId = pathname.split('/')[4];
      const child = DB.users.find(u => u.id === childId && u.parent_id === auth.id);
      if (!child) return send(res, 404, { error: '孩子不存在或不属于你' });
      const goals = DB.goals.filter(g => g.user_id === child.id);
      const checkins = DB.checkins.filter(c => c.user_id === child.id).sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0,30)
        .map(c => ({ ...c, goal_title: c.goal_id ? (DB.goals.find(g => g.id === c.goal_id)||{}).title : null }));
      const badges = DB.badges.filter(b => b.user_id === child.id);
      const pomoCount = DB.pomodoro_sessions.filter(p => p.user_id === child.id).length;
      return send(res, 200, {
        child: { id: child.id, username: child.username, display_name: child.display_name, avatar: child.avatar, stars: child.stars, level: child.level, total_study_minutes: child.total_study_minutes },
        goals, checkins, badges, pomoCount
      });
    }

    if (pathname === '/api/badges' && method === 'GET') {
      return send(res, 200, DB.badges.filter(b => b.user_id === auth.id));
    }

    send(res, 404, { error: '接口不存在' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message || '服务器错误' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  let filePath = path.join(FRONTEND, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(FRONTEND)) {
    res.writeHead(403); return res.end();
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(FRONTEND, 'index.html');
  }
  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`🌱 自觉小树服务器运行在 http://localhost:${PORT}`);
  console.log(`   打开浏览器访问上面的地址即可使用`);
});
