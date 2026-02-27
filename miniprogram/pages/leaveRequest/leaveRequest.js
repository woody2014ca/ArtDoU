// pages/leaveRequest/leaveRequest.js
const app = getApp();

Page({
  data: {
    studentId: '',
    studentName: '',
    leaveDate: '',
    reason: '',
    isAudit: false, // 默认改为 false (家长优先)
  },

  onShow: function() {
    // 1. 读缓存
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (typeof cachedMode === 'boolean') {
      this.setData({ isAudit: cachedMode });
    }

    // 2. 云端确认
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'init' }
    }).then(res => {
      const role = res.result.role;
      // 只要是家长、管理员、老师，都看正式版
      let realMode = true; 
      if (role === 'parent' || role === 'admin' || role === 'teacher') {
        realMode = false;
      }
      if (this.data.isAudit !== realMode) {
        this.setData({ isAudit: realMode });
        wx.setStorageSync('isAuditMode', realMode);
      }
    }).catch(console.error);
  },

  onLoad: function(options) {
    // 获取学生信息 (页面传参 -> 全局兜底)
    let name = options.name;
    let id = options.id;

    if (!name && app.globalData.student) {
      name = app.globalData.student.name;
      id = app.globalData.student._id;
    }

    this.setData({
      studentId: id || '',
      studentName: decodeURIComponent(name || '')
    });
  },

  bindDateChange: function(e) { this.setData({ leaveDate: e.detail.value }) },
  bindReasonInput: function(e) { this.setData({ reason: e.detail.value }) },

  submitLeave: async function() {
    if (!this.data.leaveDate) return wx.showToast({ title: '请选择日期', icon: 'none' });

    // --- A面：审核模式 (存本地) ---
    if (this.data.isAudit) {
      let list = wx.getStorageSync('audit_leaves') || [];
      list.push({ 
        date: this.data.leaveDate, 
        reason: this.data.reason || '常规维护', 
        student_name: this.data.studentName,
        status: 'pending',
        _id: Date.now()
      });
      wx.setStorageSync('audit_leaves', list);
      wx.showToast({ title: '登记成功' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    // --- B面：真实模式 (提交给老师) ---
    wx.showLoading({ title: '提交中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'add',
          collection: 'Leave_requests',
          data: {
            student_id: this.data.studentId,
            student_name: this.data.studentName,
            date: this.data.leaveDate,
            reason: this.data.reason,
            status: 0, // 0=待审批
            create_time: new Date().toISOString()
          }
        }
      });
      
      wx.hideLoading();
      console.log('云函数返回:', res); // 方便调试

      // 【核心修复】这里放宽了判断条件
      // 只要返回了 _id (原生成功) 或者 success: true (封装成功)，都算成功
      if (res.result && (res.result._id || res.result.success)) {
        wx.showToast({ title: '申请已提交' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        // 如果没有ID也没有success，才算失败
        throw new Error('提交无响应');
      }
      
    } catch (err) {
      console.error('提交报错:', err);
      wx.hideLoading();
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  }
})