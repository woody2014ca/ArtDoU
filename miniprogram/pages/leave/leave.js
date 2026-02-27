// pages/leave/leave.js - ArtDoU 安全重构版
const app = getApp();
Page({
  data: {
    pendingList: [],
    loading: true,
    isAudit: true,
  },

  onShow: function () {
    // 1. 【新增】核心逻辑：从缓存读取审核模式状态
  const cachedMode = wx.getStorageSync('isAuditMode');
  this.setData({ 
    isAudit: cachedMode === true // 只有缓存明确为 true 时才显示审核文案
  });
    if (typeof app.globalData.isAuditMode !== 'undefined') {
      this.setData({ isAudit: app.globalData.isAuditMode });
    }
    console.log("--- ArtDoU 审批页就绪，正在通过云代理抓取数据 ---");
    this.loadPendingLeaves();
  },

  /**
   * 加载待审批列表 (通过 manageData 云函数代理)
   */
  async loadPendingLeaves() {
    this.setData({ loading: true });
    
    try {
      // 1. 调用云函数获取请假记录和学生记录 (并发请求，效率最高)
      console.log("步骤1: 发起云函数并发请求...");
      const [leaveRes, studentRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'manageData',
          data: { action: 'get', collection: 'Leave_requests', id: 'all' }
        }),
        wx.cloud.callFunction({
          name: 'manageData',
          data: { action: 'get', collection: 'Students', id: 'all' }
        })
      ]);

      console.log("步骤2: 云端数据返回成功");

      // 2. 建立学生 ID 到姓名的映射表 (优化关联查询，不再循环查库)
      const studentMap = {};
      if (studentRes.result && studentRes.result.data) {
        studentRes.result.data.forEach(s => {
          studentMap[s._id] = s.name;
        });
      }

      // 3. 过滤并整合数据
      const rawLeaves = leaveRes.result.data || [];
      const finalList = rawLeaves
        .filter(item => item.status === 0) // 过滤待处理状态 (0)
        .map(item => ({
          ...item,
          studentName: studentMap[item.student_id] || "未知学员 / Unknown"
        }))
        .sort((a, b) => {
          // 按时间倒序排序
          const timeA = a.create_time ? new Date(a.create_time) : 0;
          const timeB = b.create_time ? new Date(b.create_time) : 0;
          return timeB - timeA;
        });

      console.log("步骤3: 数据加工完毕，待处理条数:", finalList.length);

      this.setData({ 
        pendingList: finalList,
        loading: false 
      });

    } catch (err) {
      console.error('致命错误: 云函数调用失败。', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 审批操作 (通过 manageData 云函数代理)
   */
  async handleAudit(e) {
    const { id, status } = e.currentTarget.dataset; // status: 1为通过, 2为拒绝
    const actionText = status === 1 ? '准假' : '拒绝';

    wx.showLoading({ title: '正在批复...', mask: true });

    try {
      // 调用云函数修改 Leave_requests 状态
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'update',
          collection: 'Leave_requests',
          id: id,
          data: { 
            status: status,
            audit_time: new Date().toLocaleString() // 使用当前时间作为审批时间
          }
        }
      });

      if (res.result && res.result.success === false) {
        throw new Error(res.result.msg);
      }

      console.log(`审批成功: ID ${id} 已设置为状态 ${status}`);
      wx.hideLoading();
      wx.showToast({ title: '已' + actionText });
      
      // 刷新列表
      this.loadPendingLeaves();

    } catch (err) {
      console.error('审批操作失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});