// pages/bindParent/bindParent.js - 家长凭手机号绑定（仅已缴费学员）
Page({
  data: {
    phone: '',
    loading: false,
    myOpenid: ''
  },

  onLoad() {
    // 🚫 入口保护：只有家长/已绑定用户可以停留在本页
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'init' }
    }).then(res => {
      const role = res.result && res.result.role;
      // 非家长（不是 parent / user）的访问一律跳回首页（审核员/老师不会停在绑定页）
      if (role !== 'parent' && role !== 'user') {
        wx.reLaunch({ url: '/pages/index/index' });
        return;
      }
      // 合法家长再去拉取 OpenID 显示在页面上
      wx.cloud.callFunction({ name: 'manageData', data: { action: 'getMyOpenid' } })
        .then(r => {
          if (r.result && r.result.openid) this.setData({ myOpenid: r.result.openid });
        })
        .catch(() => {});
    }).catch(() => {
      // 云函数异常也不暴露绑定入口，直接回首页
      wx.reLaunch({ url: '/pages/index/index' });
    });
  },

  copyOpenid() {
    if (!this.data.myOpenid) return wx.showToast({ title: 'OpenID 加载中', icon: 'none' });
    wx.setClipboardData({
      data: this.data.myOpenid,
      success: () => wx.showToast({ title: '已复制 OpenID', icon: 'none' })
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: (e.detail.value || '').trim() });
  },

  goBack() {
    wx.navigateBack();
  },

  async submitBind() {
    const phone = this.data.phone.trim();
    if (!phone) {
      return wx.showToast({ title: '请输入手机号', icon: 'none' });
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '验证中...', mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: { action: 'bindParent', phone: phone }
      });
      wx.hideLoading();
      this.setData({ loading: false });

      const result = res.result;
      if (result && result.success && result.myStudentId) {
        wx.setStorageSync('isAuditMode', false);
        wx.reLaunch({ url: `/pages/parentHome/parentHome?id=${result.myStudentId}` });
      } else {
        wx.showToast({ title: result && result.msg ? result.msg : '绑定失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    }
  }
});
