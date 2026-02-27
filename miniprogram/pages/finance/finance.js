// pages/finance/finance.js
const app = getApp(); 
Page({
  data: {
    logs: [],
    totalRevenue: 0,
    loading: true,
    isAudit: true, // 默认审核模式
  },

  onShow: function () {
    // 1. 读缓存定身份
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (cachedMode === false) {
      this.setData({ isAudit: false });
      this.fetchRealData();
    } else {
      this.setData({ isAudit: true });
      this.fetchFakeData();
    }
  },

  // --- A面：真实账本 (管理员) ---
  fetchRealData: function () {
    this.setData({ loading: true });
    
    // 这里我们直接去查 Attendance_logs (消课记录) 作为流水
    // 或者 Payment_logs (如果你的系统里有付费记录的话)
    // 假设我们主要看“消课流水”
    wx.cloud.callFunction({
      name: 'manageData',
      data: {
        action: 'get',
        collection: 'Attendance_logs',
        id: 'all'
      },
      success: res => {
        if (res.result && res.result.data) {
          const list = res.result.data.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));
          
          // 计算总消耗
          let total = 0;
          list.forEach(i => total += (Number(i.lessons_deducted) || 0));

          this.setData({
            logs: list,
            totalRevenue: total,
            loading: false
          });
        }
      },
      fail: () => this.setData({ loading: false })
    });
  },

  // --- B面：虚假账本 (审核员) ---
  fetchFakeData: function () {
    // 造几个假数据给审核员看
    const fakeLogs = [
      { student_name: '画材损耗', date: '2023-10-01', lessons_deducted: '150', price: '3000' },
      { student_name: '设备折旧', date: '2023-10-05', lessons_deducted: '50', price: '1000' },
      { student_name: '日常运维', date: '2023-10-12', lessons_deducted: '20', price: '400' }
    ];
    
    this.setData({
      logs: fakeLogs,
      totalRevenue: 220, // 假总数
      loading: false
    });
  },

  goToPaymentManage: function () {
    wx.navigateTo({ url: '/pages/paymentManage/paymentManage?from=teacher' });
  },

  editLog: function (e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/editLog/editLog?id=${id}` });
  },

  deleteLog: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条流水记录吗？',
      confirmColor: '#e53935',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });
          wx.cloud.callFunction({
            name: 'manageData',
            data: { action: 'delete', collection: 'Attendance_logs', id: id }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已删除', icon: 'success' });
            this.fetchRealData();
          }).catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  previewProof: function(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: [url] });
  }
});