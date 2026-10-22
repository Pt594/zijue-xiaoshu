# 🌳 自觉小树 - 儿童自觉学习平台

面向 **7-11岁** 儿童的网页版自觉学习系统，卡通游戏风格，支持家长端查看进度。

**零外部依赖**，只需 Node.js 即可运行。

## 功能一览

### 儿童端
- ✅ **自己设定学习目标** + 每日打卡
- 🍅 **番茄钟**（25 / 15 / 5 分钟可选）
- ⭐ **星星与等级系统**（每 10 星升 1 级）
- 🌳 **成长树可视化**（随等级变化：🌱 → 🌿 → 🌳 → 🌲 → 🌴 → 🎄）
- 🏆 **徽章系统**（首次打卡、连续打卡、星星达人、专注达人、目标达成等）
- 📚 **内置学习内容**（语文、数学、英语、科学，共 8 个小课程）
- 🎮 **游戏化奖励**（完成目标 / 番茄 / 学习均可获得星星和徽章）

### 家长端
- 绑定孩子账号
- 查看孩子目标、打卡记录、学习时长、徽章

## 快速启动

```bash
cd backend
node server-standalone.js
```

默认端口 3000。如果被占用，可指定端口：

```bash
PORT=3456 node server-standalone.js
```

浏览器打开：http://localhost:3000 （或你指定的端口）

## 使用说明

1. **先注册家长账号**（角色选择「家长」）
2. **再注册孩子账号**（角色选择「小朋友」，填写家长用户名即可绑定）
3. 孩子登录后即可开始设定目标、打卡、使用番茄钟、学习内容
4. 家长登录后可在「家长中心」查看孩子的成长情况

## 技术说明

- **前端**：原生 HTML + CSS + JavaScript（卡通游戏风格）
- **后端**：纯 Node.js `http` 模块（零 npm 依赖）
- **数据存储**：JSON 文件（`backend/data.json`）
- **认证**：HMAC 签名 Token（30 天有效）
- **密码**：Node.js `crypto.scrypt`

## 部署建议

### 自己的服务器 / VPS
```bash
cd backend
nohup node server-standalone.js > app.log 2>&1 &
```
可用 Nginx 反向代理到对应端口。

### Railway / Render / Fly.io
1. 把整个项目推到 GitHub
2. 新建 Web Service，启动命令：
   ```
   node backend/server-standalone.js
   ```
3. 设置环境变量 `PORT`（平台通常会自动注入）

## 目录结构

```
zijue-xiaoshu/
├── backend/
│   ├── server-standalone.js   # 主服务器（推荐使用这个）
│   └── data.json              # 数据文件（运行后自动生成）
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── README.md
```

---

Made with 🌱 for kids who love learning.
