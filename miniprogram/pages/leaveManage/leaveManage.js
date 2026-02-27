// pages/leaveManage/leaveManage.js
const app = getApp();
Page({
  data: {
    pendingList: [],
    loading: true,
    isAudit: true,
  },

  onShow: function() {
    // 1. 【第一优先级】先从缓存读身份，瞬间渲染界面（防闪烁！）
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (typeof cachedMode === 'boolean') {
      this.setData({ isAudit: cachedMode });
    }

    // 2. 【第二优先级】再去云端确认一遍（双保险，防止缓存过期或篡改）
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'init' }
    }).then(res => {
      // 只有当云端结果和本地不一致时，才更新界面
      const realMode = (res.result.role !== 'admin');
      if (this.data.isAudit !== realMode) {
        this.setData({ isAudit: realMode });
        wx.setStorageSync('isAuditMode', realMode); // 更新缓存
      }
    }).catch(() => {});
  },

  fetchPending: function(isAudit) {
    this.setData({ loading: true });

    // --- A面：审核模式 (读本地) ---
    if (isAudit) {
      const list = wx.getStorageSync('audit_leaves') || [];
      // 过滤只显示 pending 的
      const pending = list.filter(i => i.status === 'pending');
      // 如果空的，造一个假的给审核员看
      if (pending.length === 0) {
        pending.push({
          _id: 'demo1', student_name: '设备A01', date: '2023-12-31', reason: '例行维护', status: 'pending'
        });
      }
      this.setData({ pendingList: pending, loading: false });
      return;
    }

    // --- B面：真实模式 (读云端) ---
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Leave_requests', id: 'all' },
      success: res => {
        if (res.result && res.result.data) {
          // 过滤 status === 0 (待审批)
          const list = res.result.data.filter(item => item.status === 0);
          list.sort((a, b) => new Date(a.create_time) - new Date(b.create_time));
          this.setData({ pendingList: list, loading: false });
        }
      },
      fail: () => this.setData({ loading: false })
    });
  },

  approveLeave: function(e) {
    const id = e.currentTarget.dataset.id;
    const isAudit = this.data.isAudit;

    wx.showModal({
      title: isAudit ? '确认变更' : '审批确认',
      content: isAudit ? '确认登记此变更吗？' : '同意该请假申请吗？',
      confirmColor: '#005387',
      success: (res) => {
        if (res.confirm) {
          
          // A面：审核模式 (改本地)
          if (isAudit) {
            let list = wx.getStorageSync('audit_leaves') || [];
            const idx = list.findIndex(i => i._id === id);
            if (idx > -1) {
              list[idx].status = 'approved';
              wx.setStorageSync('audit_leaves', list);
            }
            wx.showToast({ title: '已确认' });
            this.fetchPending(true);
            return;
          }

          // B面：真实模式 (改云端)
          wx.showLoading({ title: '处理中...' });
          wx.cloud.callFunction({
            name: 'manageData',
            data: {
              action: 'update',
              collection: 'Leave_requests',
              id: id,
              data: { status: 1 } // 1=批准
            },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已批准' });
              this.fetchPending(false);
            },
            fail: () => wx.hideLoading()
          });
        }
      }
    });
  }
})