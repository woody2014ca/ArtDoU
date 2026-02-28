# 小程序 → Web 迁移方案（kunlunfo.com）

## 一、目标
将微信小程序全部功能迁移到 Web，使用域名 **www.kunlunfo.com** 对外提供，家长在加州尔湾用浏览器即可访问。

## 二、小程序功能清单（需迁移的页面）

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | index | 身份分流(老师/家长)、数据看板、学员名录、家长入口(意向缴费/绑定) |
| 家长绑定 | bindParent | 家长凭手机号绑定 |
| 查找学员缴费 | findStudentToPay | 意向/正式学员缴费前查找学员 |
| 家长首页 | parentHome | 家长端首页、展厅、请假等 |
| 消课 | checkin | 消课/记录 |
| 新学员 | addStudent | 添加学员 |
| 意向登记 | enroll | 意向登记 |
| 请假 | leave | 请假列表 |
| 历史 | history | 历史记录 |
| 请假申请 | leaveRequest | 家长提交请假 |
| 请假管理 | leaveManage | 老师审批请假 |
| 意向名单 | enrollList | 意向名单管理 |
| 海报 | poster | 选图、生成海报、分享 |
| 缴费 | payment | 缴费提交 |
| 缴费管理 | paymentManage | 缴费确认、意向转正 |
| 编辑学员 | editStudent | 编辑学员信息 |
| 编辑记录 | editLog | 编辑消课记录 |
| 财务 | finance | 财务汇总 |

## 三、云函数 manageData 动作与对应 REST API

| 动作 | 说明 | Web API |
|------|------|--------|
| init | 身份/角色 | GET /api/auth/init |
| get | 查询列表/单条 | GET /api/data/:collection/:id? |
| add | 新增 | POST /api/data/:collection |
| update | 更新 | PATCH /api/data/:collection/:id |
| delete | 删除 | DELETE /api/data/:collection/:id |
| increment | 课时增减 | POST /api/data/:collection/:id/increment |
| bindParent | 家长绑定 | POST /api/auth/bind |
| findStudentForPayment | 缴费前查学员 | POST /api/payment/find-student |
| confirmProspectivePayment | 意向转正 | POST /api/payment/confirm |
| getMyOpenid | 获取 openid | （Web 不需要） |
| setParentByOpenid | 后台设家长 | POST /api/admin/set-parent |

## 四、技术选型

- **后端**：Node.js + Express，逻辑与现有云函数 manageData 对齐；鉴权用 JWT（Web 无 openid）。
- **数据库**：MongoDB（与微信云开发结构一致，可从云开发导出后导入自建/Atlas）。
- **前端**：React + Vite，React Router，按页面拆分为组件。
- **部署**：前端可部署到 Vercel/Netlify 或与后端同域；后端部署到 Render/Railway/自建；域名 www.kunlunfo.com 解析到前端或网关。

## 五、鉴权设计（Web）

- **老师/管理员**：登录接口（如密码或后续改为邮箱+密码），服务端签发 JWT，payload 含 `role: 'admin'`。
- **家长**：在「家长绑定」页输入手机号，后端校验手机号对应已缴费学员后签发 JWT，payload 含 `role: 'parent'`, `myStudentId`。
- **未登录**：无 token 仅可访问家长入口（意向缴费/绑定），不可读数据。

## 六、迁移顺序建议

1. 搭建后端 API 与鉴权（本仓库 `web/backend`）。
2. 搭建前端骨架与路由（`web/frontend`），实现登录 + 首页（身份分流 + 看板 + 学员名录）。
3. 按模块迁移：家长绑定与家长首页 → 消课/请假/意向/缴费 → 海报 → 财务/其他管理页。
4. 数据迁移：从微信云开发导出集合，导入 MongoDB，必要时写脚本映射 openid 与 Web 账号。
5. 部署与域名：配置 www.kunlunfo.com 指向前端，API 使用同域或 api.kunlunfo.com。

## 七、当前仓库结构

```
web/
├── README-MIGRATION.md   # 本说明
├── backend/              # Node + Express API
│   ├── package.json
│   ├── server.js
│   ├── routes/
│   └── db.js
└── frontend/             # React + Vite
    ├── package.json
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── pages/
    │   └── api.js
    └── index.html
```

完成上述骨架后，按「迁移顺序建议」逐页迁移即可。

---

## 八、本地运行说明

**后端**

```bash
cd web/backend
cp .env.example .env   # 按需修改 MONGODB_URI、ADMIN_PASSWORD、JWT_SECRET
npm install
npm run dev
```

默认端口 3001；需本地或远程 MongoDB，库名默认 `artdou`，集合与小程序云开发一致（Students、Attendance_logs、Parent_bindings、Prospective_students、Payment_logs、Leave_requests、Teachers、configs 等）。

**前端**

```bash
cd web/frontend
npm install
npm run dev
```

默认打开 http://localhost:5173，开发时已配置代理将 `/api` 转发到后端 3001。

**鉴权**

- 老师/管理员：访问 `/login`，输入 `.env` 中 `ADMIN_PASSWORD`（默认 `admin`）登录。
- 家长：从首页带 `?from=parent` 进入家长入口，或直接访问 `/bind` 输入与报名一致的手机号绑定；绑定后自动跳转家长首页。
- 未登录：首页仅显示家长入口（意向缴费、绑定手机号）及老师登录，无数据列表。
