const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, BADGE_DEFINITIONS } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'zijue-xiaoshu-secret-key-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

function now() {
  return new Date().toISOString();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    const token = authHeader.slice(7);
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function calculateLevel(stars) {
  return Math.min(20, Math.floor(stars / 10) + 1);
}

function awardBadge(userId, badgeKey) {
  const def = BADGE_DEFINITIONS[badgeKey];
  if (!def) return null;
  const badge = db.createBadge({
    id: uuidv4(),
    user_id: userId,
    badge_key: badgeKey,
    badge_name: def.name,
    badge_icon: def.icon,
    earned_at: now()
  });
  return badge ? def : null;
}

function checkAndAwardBadges(userId) {
  const user = db.findUserById(userId);
  if (!user) return [];
  const awarded = [];

  if (user.stars >= 10) {
    const b = awardBadge(userId, 'stars_10');
    if (b) awarded.push(b);
  }
  if (user.stars >= 50) {
    const b = awardBadge(userId, 'stars_50');
    if (b) awarded.push(b);
  }
  if (user.level >= 3) {
    const b = awardBadge(userId, 'level_3');
    if (b) awarded.push(b);
  }
  if (user.level >= 5) {
    const b = awardBadge(userId, 'level_5');
    if (b) awarded.push(b);
  }

  const checkins = db.findCheckinsByUserId(userId, 30);
  const uniqueDays = [...new Set(checkins.map(c => (c.created_at || '').slice(0, 10)))];
  if (uniqueDays.length >= 3) {
    const b = awardBadge(userId, 'streak_3');
    if (b) awarded.push(b);
  }
  if (uniqueDays.length >= 7) {
    const b = awardBadge(userId, 'streak_7');
    if (b) awarded.push(b);
  }

  if (db.countPomodoros(userId) >= 5) {
    const b = awardBadge(userId, 'pomodoro_5');
    if (b) awarded.push(b);
  }

  const completedGoals = db.findGoalsByUserId(userId).filter(g => g.status === 'completed').length;
  if (completedGoals >= 1) {
    const b = awardBadge(userId, 'goal_complete');
    if (b) awarded.push(b);
  }

  return awarded;
}

// ========== 认证 ==========
app.post('/api/register', (req, res) => {
  const { username, password, displayName, role, parentUsername } = req.body;
  if (!username || !password || !displayName || !role) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (!['child', 'parent'].includes(role)) {
    return res.status(400).json({ error: '角色无效' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少4位' });
  }
  if (db.findUserByUsername(username)) {
    return res.status(400).json({ error: '用户名已被使用' });
  }

  let parentId = null;
  if (role === 'child' && parentUsername) {
    const parent = db.findUserByUsername(parentUsername);
    if (!parent || parent.role !== 'parent') {
      return res.status(400).json({ error: '家长账号不存在' });
    }
    parentId = parent.id;
  }

  const user = {
    id: uuidv4(),
    username,
    password_hash: bcrypt.hashSync(password, 10),
    display_name: displayName,
    role,
    parent_id: parentId,
    avatar: role === 'child' ? '🌱' : '👨‍👩‍👧',
    stars: 0,
    level: 1,
    total_study_minutes: 0,
    created_at: now()
  };
  db.createUser(user);

  const safeUser = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    avatar: user.avatar,
    stars: 0,
    level: 1
  };
  res.json({ token: generateToken(user), user: safeUser });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const user = db.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const safeUser = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    avatar: user.avatar,
    stars: user.stars,
    level: user.level,
    total_study_minutes: user.total_study_minutes
  };
  res.json({ token: generateToken(user), user: safeUser });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const badges = db.findBadgesByUserId(user.id);
  res.json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    avatar: user.avatar,
    stars: user.stars,
    level: user.level,
    total_study_minutes: user.total_study_minutes,
    parent_id: user.parent_id,
    badges
  });
});

// ========== 目标 ==========
app.get('/api/goals', authMiddleware, (req, res) => {
  res.json(db.findGoalsByUserId(req.user.id));
});

app.post('/api/goals', authMiddleware, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: '只有孩子可以设定目标' });
  }
  const { title, description, subject, targetCount } = req.body;
  if (!title) return res.status(400).json({ error: '请填写目标标题' });

  const goal = {
    id: uuidv4(),
    user_id: req.user.id,
    title,
    description: description || '',
    subject: subject || '综合',
    target_count: targetCount || 7,
    current_count: 0,
    status: 'active',
    created_at: now(),
    completed_at: null
  };
  db.createGoal(goal);
  res.json(goal);
});

app.patch('/api/goals/:id', authMiddleware, (req, res) => {
  const goal = db.findGoalById(req.params.id);
  if (!goal || goal.user_id !== req.user.id) {
    return res.status(404).json({ error: '目标不存在' });
  }
  const { status } = req.body;
  if (status === 'completed') {
    db.updateGoal(goal.id, { status: 'completed', completed_at: now() });
    const user = db.findUserById(req.user.id);
    const newStars = user.stars + 5;
    const newLevel = calculateLevel(newStars);
    db.updateUser(req.user.id, { stars: newStars, level: newLevel });
    awardBadge(req.user.id, 'goal_complete');
  } else if (status === 'abandoned') {
    db.updateGoal(goal.id, { status: 'abandoned' });
  }
  res.json(db.findGoalById(goal.id));
});

// ========== 打卡 ==========
app.post('/api/checkin', authMiddleware, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: '只有孩子可以打卡' });
  }
  const { goalId, note, studyMinutes } = req.body;
  const starsEarned = 1 + (studyMinutes >= 25 ? 1 : 0);

  const checkin = {
    id: uuidv4(),
    user_id: req.user.id,
    goal_id: goalId || null,
    note: note || '',
    stars_earned: starsEarned,
    study_minutes: studyMinutes || 0,
    created_at: now()
  };
  db.createCheckin(checkin);

  if (goalId) {
    const goal = db.findGoalById(goalId);
    if (goal && goal.user_id === req.user.id && goal.status === 'active') {
      const newCount = goal.current_count + 1;
      const updates = { current_count: newCount };
      if (newCount >= goal.target_count) {
        updates.status = 'completed';
        updates.completed_at = now();
        awardBadge(req.user.id, 'goal_complete');
      }
      db.updateGoal(goalId, updates);
    }
  }

  const user = db.findUserById(req.user.id);
  const newStars = user.stars + starsEarned;
  const newLevel = calculateLevel(newStars);
  const newMinutes = (user.total_study_minutes || 0) + (studyMinutes || 0);
  db.updateUser(req.user.id, { stars: newStars, level: newLevel, total_study_minutes: newMinutes });

  if (db.countCheckins(req.user.id) === 1) {
    awardBadge(req.user.id, 'first_checkin');
  }
  const newBadges = checkAndAwardBadges(req.user.id);

  res.json({
    checkin: { id: checkin.id, stars_earned: starsEarned },
    user: { stars: newStars, level: newLevel, total_study_minutes: newMinutes },
    newBadges
  });
});

app.get('/api/checkins', authMiddleware, (req, res) => {
  const checkins = db.findCheckinsByUserId(req.user.id);
  const result = checkins.map(c => {
    const goal = c.goal_id ? db.findGoalById(c.goal_id) : null;
    return { ...c, goal_title: goal ? goal.title : null };
  });
  res.json(result);
});

// ========== 番茄钟 ==========
app.post('/api/pomodoro', authMiddleware, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: '只有孩子可以使用番茄钟' });
  }
  const duration = req.body.durationMinutes || 25;
  db.createPomodoro({
    id: uuidv4(),
    user_id: req.user.id,
    duration_minutes: duration,
    completed: true,
    created_at: now()
  });

  const user = db.findUserById(req.user.id);
  const newStars = user.stars + 1;
  const newLevel = calculateLevel(newStars);
  const newMinutes = (user.total_study_minutes || 0) + duration;
  db.updateUser(req.user.id, { stars: newStars, level: newLevel, total_study_minutes: newMinutes });

  const newBadges = checkAndAwardBadges(req.user.id);
  res.json({
    session: { duration_minutes: duration },
    stars_earned: 1,
    user: { stars: newStars, level: newLevel, total_study_minutes: newMinutes },
    newBadges
  });
});

// ========== 学习内容 ==========
app.get('/api/content', authMiddleware, (req, res) => {
  res.json(db.getAllContent().map(c => ({
    id: c.id, title: c.title, subject: c.subject,
    description: c.description, difficulty: c.difficulty,
    stars_reward: c.stars_reward, icon: c.icon
  })));
});

app.get('/api/content/:id', authMiddleware, (req, res) => {
  const content = db.findContentById(req.params.id);
  if (!content) return res.status(404).json({ error: '内容不存在' });
  res.json(content);
});

app.post('/api/content/:id/complete', authMiddleware, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: '只有孩子可以完成学习' });
  }
  const content = db.findContentById(req.params.id);
  if (!content) return res.status(404).json({ error: '内容不存在' });

  const starsAdd = content.stars_reward || 2;
  const user = db.findUserById(req.user.id);
  const newStars = user.stars + starsAdd;
  const newLevel = calculateLevel(newStars);
  db.updateUser(req.user.id, { stars: newStars, level: newLevel });

  db.createCheckin({
    id: uuidv4(),
    user_id: req.user.id,
    goal_id: null,
    note: `完成学习：${content.title}`,
    stars_earned: starsAdd,
    study_minutes: 10,
    created_at: now()
  });

  const newBadges = checkAndAwardBadges(req.user.id);
  res.json({
    stars_earned: starsAdd,
    user: { stars: newStars, level: newLevel },
    newBadges
  });
});

// ========== 家长端 ==========
app.get('/api/parent/children', authMiddleware, (req, res) => {
  if (req.user.role !== 'parent') {
    return res.status(403).json({ error: '只有家长可以查看' });
  }
  const children = db.findChildrenByParentId(req.user.id).map(c => ({
    id: c.id,
    username: c.username,
    display_name: c.display_name,
    avatar: c.avatar,
    stars: c.stars,
    level: c.level,
    total_study_minutes: c.total_study_minutes,
    created_at: c.created_at
  }));
  res.json(children);
});

app.get('/api/parent/child/:childId', authMiddleware, (req, res) => {
  if (req.user.role !== 'parent') {
    return res.status(403).json({ error: '只有家长可以查看' });
  }
  const child = db.findUserById(req.params.childId);
  if (!child || child.parent_id !== req.user.id) {
    return res.status(404).json({ error: '孩子不存在或不属于你' });
  }

  const goals = db.findGoalsByUserId(child.id);
  const checkins = db.findCheckinsByUserId(child.id, 30).map(c => {
    const goal = c.goal_id ? db.findGoalById(c.goal_id) : null;
    return { ...c, goal_title: goal ? goal.title : null };
  });
  const badges = db.findBadgesByUserId(child.id);
  const pomoCount = db.countPomodoros(child.id);

  res.json({
    child: {
      id: child.id,
      username: child.username,
      display_name: child.display_name,
      avatar: child.avatar,
      stars: child.stars,
      level: child.level,
      total_study_minutes: child.total_study_minutes
    },
    goals,
    checkins,
    badges,
    pomoCount
  });
});

app.get('/api/badges', authMiddleware, (req, res) => {
  res.json(db.findBadgesByUserId(req.user.id));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌱 自觉小树服务器运行在 http://localhost:${PORT}`);
});
