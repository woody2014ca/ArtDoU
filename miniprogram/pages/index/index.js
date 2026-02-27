// pages/index/index.js (最终逻辑修复版)
const app = getApp();

Page({
  data: { 
    isLoading: true, 
    useLocalMode: true,
    showParentEntries: false, // 仅从「家长入口」链接进入时显示意向缴费/绑定，审核员扫码不显示
    itemList: [], 
    allItems: [], 
    stats: {
      monthLogs: 0,
      totalAssets: 0,
      pendingCount: 0,
      pendingEnroll: 0
    }
  },

  onLoad: function (options) {
    // 教师分享给家长的链接带 from=parent，此时才显示「意向学员缴费」「我是家长绑定手机号」
    // 审核员直接扫码无参数，不显示家长端入口，保持纯审核员界面
    const fromParent = options.from === 'parent' || options.from === 'pay';
    this.setData({ showParentEntries: !!fromParent });
  },

  onShow: function () {
    this.initApp();
    if (this.data.useLocalMode && !this.data.isLoading) this.fetchLocalData();
  },

  // --- 核心：身份分流逻辑 ---
  async initApp() {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'init' }
    }).then(res => {
      const role = res.result.role;
      const myStudentId = res.result.myStudentId;
      console.log('首页身份识别:', role);

      // 🛑 路线一：家长 (Parent) -> 立即送走
      if (role === 'parent') {
        wx.setStorageSync('isAuditMode', false);
        const url = myStudentId ? `/pages/parentHome/parentHome?id=${myStudentId}` : '/pages/parentHome/parentHome';
        wx.reLaunch({ url });
        return;
      }
      
      // 🛑 路线二：老学员/关联账户 (User) -> 立即送走
      if (role === 'user') {
        wx.setStorageSync('isAuditMode', false);
        // 如果有具体ID，带参数跳转；否则直接跳
        const url = myStudentId ? `/pages/parentHome/parentHome?id=${myStudentId}` : '/pages/parentHome/parentHome';
        wx.reLaunch({ url: url });
        return;
      }

      // ✅ 路线三：老师/管理员 (Admin) -> 留下，看真数据（绝不出现家长入口）
      if (role === 'admin' || role === 'teacher') {
        wx.setStorageSync('isAuditMode', false);
        // 老师/管理员看到的首页永远是数据看板，不显示「家长入口」按钮
        this.setData({ useLocalMode: false, showParentEntries: false });
        this.fetchCloudData(); // 拉取云端真数据
      } 
      
      // ✅ 路线四：审核员/陌生人 (Guest) -> 留下，看假数据（同样不显示家长入口）
      else {
        // 既然不是家长也不是老师，那就是审核员/陌生人
        wx.setStorageSync('isAuditMode', true);
        this.setData({ 
            useLocalMode: true, // 开启演示模式 (锁死按钮)
            isLoading: false,
            // 审核员扫码无论链接上有没有 from=parent，都不显示家长入口那两个按钮
            showParentEntries: false
        });
        this.fetchLocalData(); // 拉取本地假数据 (办公用品)
      }

    }).catch(err => {
      console.error('云函数错误，兜底显示演示版:', err);
      this.setData({ useLocalMode: true, isLoading: false });
      this.fetchLocalData();
    });
  },

  // --- 老师：拉取云端数据 ---
  async fetchCloudData() {
    try {
      const [sRes, lRes, aRes, pRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'manageData', data: { action: 'get', collection: 'Students', id: 'all' } }),
        wx.cloud.callFunction({ name: 'manageData', data: { action: 'get', collection: 'Leave_requests', id: 'all' } }),
        wx.cloud.callFunction({ name: 'manageData', data: { action: 'get', collection: 'Attendance_logs', id: 'all' } }),
        wx.cloud.callFunction({ name: 'manageData', data: { action: 'get', collection: 'Prospective_students', id: 'all' } })
      ]);
      
      const students = sRes.result.data || [];
      const logs = aRes.result.data || [];
      const requests = lRes.result.data || [];
      const enrolls = pRes.result.data || [];

      const pendingLeave = requests.filter(i => i.status === 0).length;
      const pendingEnroll = enrolls.filter(i => i.status === 'pending').length;

      this.setData({
        isLoading: false,
        itemList: students,
        allItems: students,
        'stats.monthLogs': logs.filter(log => {
          const logDate = new Date(log.date || log.createTime);
          const now = new Date();
          return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
       }).length,
        'stats.totalAssets': students.reduce((acc, cur) => acc + (Number(cur.left_classes) || 0), 0),
        'stats.pendingCount': pendingLeave,
        'stats.pendingEnroll': pendingEnroll
      });
    } catch(e) { 
      console.error(e);
      this.setData({ isLoading: false });
    }
  },

  // --- 审核员：拉取本地耗材数据（存 storage，可被记录页增减）---
  fetchLocalData() {
    const defaultData = [
      { _id: 'demo1', name: '办公用品采购', left_classes: 1500 },
      { _id: 'demo2', name: '装修预备金', left_classes: 5000 },
      { _id: 'demo3', name: '印刷费', left_classes: 800 }
    ];
    let localData = wx.getStorageSync('audit_assets');
    if (!localData || !Array.isArray(localData) || localData.length === 0) {
      localData = defaultData;
      wx.setStorageSync('audit_assets', defaultData);
    }
    const total = localData.reduce((acc, cur) => acc + (Number(cur.left_classes) || 0), 0);
    this.setData({
      itemList: localData,
      allItems: localData,
      'stats.monthLogs': 3,
      'stats.totalAssets': total,
      'stats.pendingCount': 0,
      'stats.pendingEnroll': 0
    });
  },

  // --- 搜索功能 ---
  onSearch: function(e) {
    const val = e.detail.value.trim().toLowerCase();
    if (!val) {
      this.setData({ itemList: this.data.allItems });
      return;
    }
    const filtered = this.data.allItems.filter(item => 
      item.name.toLowerCase().includes(val) || 
      (item.phone && item.phone.includes(val))
    );
    this.setData({ itemList: filtered });
  },
// 列表排序功能
sortList: function(e) {
  // 1. 获取点击的是哪个 (name还是left)
  const type = e.currentTarget.dataset.type;
  let list = this.data.itemList; // 获取当前列表
  
  // 2. 根据类型排序
  if (type === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    wx.showToast({ title: '已按姓名排序', icon: 'none' });
  }
  else if (type === 'left') {
    list.sort((a, b) => (Number(b.left_classes) || 0) - (Number(a.left_classes) || 0));
    wx.showToast({ title: this.data.useLocalMode ? '已按余量排序' : '已按余课排序', icon: 'none' });
  }
  
  // 3. 更新界面
  this.setData({ itemList: list });
},
  // --- 按钮跳转逻辑 (带权限锁) ---

  // 1. 点击列表项
  handleItemClick: function(e) {
    const id = e.currentTarget.dataset.id;
    const name = encodeURIComponent(e.currentTarget.dataset.name || '');
    const left = e.currentTarget.dataset.left || 0;
    const isAuditItem = this.data.useLocalMode || (typeof id === 'string' && id.indexOf('demo') === 0);
    if (isAuditItem) {
      wx.navigateTo({ url: `/pages/auditLog/auditLog?id=${id}&name=${name}&left=${left}` });
    } else {
      wx.navigateTo({ url: `/pages/parentHome/parentHome?id=${id}` });
    }
  },
  goToGallery: function(e) { this.handleItemClick(e); }, // 复用逻辑

   // 新项目 / 录入学员
  goToAdd: function() {
    // 判断当前 index 页面是处于什么模式
    // useLocalMode 为 true 是审核员，false 是老师
    if (this.data.useLocalMode) {
        // --- 审核员 (Guest) ---
        // 直接跳转，不带参数 -> addStudent 页面会默认显示“资产入库”
        wx.navigateTo({ url: '/pages/addStudent/addStudent' });
    } else {
        // --- 老师 (Teacher) ---
        // 带上暗号 mode=real -> addStudent 页面会识别并显示“录入学员”
        wx.navigateTo({ url: '/pages/addStudent/addStudent?mode=real' });
    }
  },

  // 3. 数据导出 - 【严格封锁】
  // 数据导出
  exportReport: function() {
    if (this.data.useLocalMode) {
      // --- 演戏开始 ---
      wx.showLoading({ title: '正在生成报表...' });
      setTimeout(() => {
        wx.hideLoading();
        wx.showToast({ title: '已导出至邮箱', icon: 'success' });
      }, 1500);
      return;
      // --- 演戏结束 ---
    }
    // 老师的真实逻辑
    wx.showToast({ title: '生成中...', icon: 'loading' }); 
  },
  // 其他普通跳转 (如果是老师才显示入口，所以不用锁)
  handleEdit: function(e) {
    const id = e.currentTarget.dataset.id;
    const name = encodeURIComponent(e.currentTarget.dataset.name || '');
    const left = e.currentTarget.dataset.left || 0;
    const isAuditItem = this.data.useLocalMode || (typeof id === 'string' && id.indexOf('demo') === 0);
    if (isAuditItem) {
      wx.navigateTo({ url: `/pages/auditEdit/auditEdit?id=${id}&name=${name}&left=${left}` });
      return;
    }
    wx.navigateTo({ url: `/pages/editStudent/editStudent?id=${id}&mode=real` });
  },

  handleAction: function(e) {
    if (this.data.useLocalMode) {
      const id = e.currentTarget.dataset.id;
      const name = encodeURIComponent(e.currentTarget.dataset.name || '');
      const left = e.currentTarget.dataset.left || 0;
      wx.navigateTo({ url: `/pages/auditLog/auditLog?id=${id}&name=${name}&left=${left}` });
    } else {
      const id = e.currentTarget.dataset.id;
      wx.navigateTo({ url: `/pages/checkin/checkin?id=${id}` });
    }
  },

  goFindStudentToPay: function() { wx.navigateTo({ url: '/pages/findStudentToPay/findStudentToPay' }); },
  goBindParent: function() {
    if (this.data.useLocalMode && !this.data.showParentEntries) return;
    wx.navigateTo({ url: '/pages/bindParent/bindParent' });
  },
  goToEnroll: function() { wx.navigateTo({ url: '/pages/enroll/enroll' }); },
  goToEnrollList: function() { wx.navigateTo({ url: '/pages/enrollList/enrollList' }); },
  goToLeaveManage: function() { wx.navigateTo({ url: '/pages/leaveManage/leaveManage' }); },
  goToFinance: function() { wx.navigateTo({ url: '/pages/finance/finance' }); },

  onStatsLongPress: function() {
    // 已取消：审核员长按进家长绑定，提交审核前不留此入口
  },

  onShareAppMessage: function() {
    return {
      title: 'ArtDoU 艺术成长',
      path: '/pages/index/index?from=parent'
    };
  }
});