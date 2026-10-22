const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  users: [],
  goals: [],
  checkins: [],
  badges: [],
  pomodoro_sessions: [],
  content: [
    {
      id: 'c1', title: '认识分数', subject: '数学',
      description: '学习分数的基本概念和表示方法',
      content_body: '分数表示整体的一部分。分子在上，分母在下。比如 1/2 表示把一个苹果分成两半，取其中一半。\n\n练习：把一个圆形分成4份，涂色3份，用分数表示是？',
      difficulty: 1, stars_reward: 3, icon: '🔢'
    },
    {
      id: 'c2', title: '古诗《静夜思》', subject: '语文',
      description: '背诵并理解李白的经典古诗',
      content_body: '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。\n\n作者：李白\n意思：诗人在安静的夜里看到月光，想起了家乡。',
      difficulty: 1, stars_reward: 3, icon: '📜'
    },
    {
      id: 'c3', title: '动物的栖息地', subject: '科学',
      description: '了解不同动物生活在什么地方',
      content_body: '北极熊生活在寒冷的北极，有厚厚的白毛保暖。\n骆驼生活在沙漠，可以很久不喝水。\n熊猫喜欢吃竹子，主要生活在中国四川。\n\n想一想：企鹅住在哪里？',
      difficulty: 1, stars_reward: 2, icon: '🐻'
    },
    {
      id: 'c4', title: '日常英语对话：打招呼', subject: '英语',
      description: '学习基本的英语问候语',
      content_body: 'Hello! / Hi! 你好！\nGood morning! 早上好！\nHow are you? 你好吗？\nI am fine, thank you. 我很好，谢谢。\nNice to meet you! 很高兴认识你！\n\n试着和家人用英语打招呼吧！',
      difficulty: 1, stars_reward: 2, icon: '🗣️'
    },
    {
      id: 'c5', title: '乘法口诀表（1-5）', subject: '数学',
      description: '熟练掌握1到5的乘法口诀',
      content_body: '一一得一\n一二得二 二二得四\n一三得三 二三得六 三三得九\n一四得四 二四得八 三四十二 四四十六\n一五得五 二五一十 三五十五 四五二十 五五二十五\n\n每天背一遍，很快就能记住！',
      difficulty: 2, stars_reward: 4, icon: '✖️'
    },
    {
      id: 'c6', title: '保护环境小知识', subject: '科学',
      description: '学习如何保护我们的地球',
      content_body: '1. 节约用水用电\n2. 垃圾分类投放\n3. 少用一次性塑料袋\n4. 多种树，保护森林\n5. 爱护小动物\n\n今天你能为地球做一件什么事？',
      difficulty: 1, stars_reward: 2, icon: '🌍'
    },
    {
      id: 'c7', title: '成语故事：守株待兔', subject: '语文',
      description: '学习经典成语及其寓意',
      content_body: '从前有个农夫，看到一只兔子撞死在树桩上，就天天守着树桩等兔子。结果再也没有兔子来，田地也荒了。\n\n寓意：不要把偶然的运气当成必然，要靠自己的努力。',
      difficulty: 2, stars_reward: 3, icon: '📖'
    },
    {
      id: 'c8', title: '认识时间', subject: '数学',
      description: '学会看时钟，理解时、分、秒',
      content_body: '时钟有时针（短）和分针（长）。\n时针走一大格是1小时，分针走一圈是60分钟。\n\n练习：现在是3点半，时针指向哪里？分针指向哪里？',
      difficulty: 1, stars_reward: 3, icon: '⏰'
    }
  ]
};

const BADGE_DEFINITIONS = {
  first_checkin: { name: '初次打卡', icon: '🌟' },
  streak_3: { name: '连续3天', icon: '🔥' },
  streak_7: { name: '连续一周', icon: '💪' },
  stars_10: { name: '十星达人', icon: '⭐' },
  stars_50: { name: '五十星勇士', icon: '🌠' },
  level_3: { name: '成长三级', icon: '🌱' },
  level_5: { name: '成长五级', icon: '🌳' },
  pomodoro_5: { name: '专注达人', icon: '🍅' },
  goal_complete: { name: '目标达成', icon: '🎯' },
  content_3: { name: '好奇宝宝', icon: '📚' },
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('读取数据库失败，使用默认数据', e.message);
  }
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  save(data);
  return data;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

let data = load();

const db = {
  findUserByUsername(username) {
    return data.users.find(u => u.username === username);
  },
  findUserById(id) {
    return data.users.find(u => u.id === id);
  },
  createUser(user) {
    data.users.push(user);
    save(data);
    return user;
  },
  updateUser(id, updates) {
    const user = data.users.find(u => u.id === id);
    if (user) Object.assign(user, updates);
    save(data);
    return user;
  },
  findChildrenByParentId(parentId) {
    return data.users.filter(u => u.parent_id === parentId && u.role === 'child');
  },

  findGoalsByUserId(userId) {
    return data.goals
      .filter(g => g.user_id === userId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  findGoalById(id) {
    return data.goals.find(g => g.id === id);
  },
  createGoal(goal) {
    data.goals.push(goal);
    save(data);
    return goal;
  },
  updateGoal(id, updates) {
    const goal = data.goals.find(g => g.id === id);
    if (goal) Object.assign(goal, updates);
    save(data);
    return goal;
  },

  findCheckinsByUserId(userId, limit = 50) {
    return data.checkins
      .filter(c => c.user_id === userId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, limit);
  },
  createCheckin(checkin) {
    data.checkins.push(checkin);
    save(data);
    return checkin;
  },
  countCheckins(userId) {
    return data.checkins.filter(c => c.user_id === userId).length;
  },

  findBadgesByUserId(userId) {
    return data.badges
      .filter(b => b.user_id === userId)
      .sort((a, b) => (b.earned_at || '').localeCompare(a.earned_at || ''));
  },
  hasBadge(userId, badgeKey) {
    return data.badges.some(b => b.user_id === userId && b.badge_key === badgeKey);
  },
  createBadge(badge) {
    if (this.hasBadge(badge.user_id, badge.badge_key)) return null;
    data.badges.push(badge);
    save(data);
    return badge;
  },

  createPomodoro(session) {
    data.pomodoro_sessions.push(session);
    save(data);
    return session;
  },
  countPomodoros(userId) {
    return data.pomodoro_sessions.filter(p => p.user_id === userId && p.completed).length;
  },

  getAllContent() {
    return data.content;
  },
  findContentById(id) {
    return data.content.find(c => c.id === id);
  }
};

module.exports = { db, BADGE_DEFINITIONS };
