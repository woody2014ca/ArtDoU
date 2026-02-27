// pages/enroll/enroll.js
const app = getApp();
Page({
  data: {
    isAudit: true, 
    realLevels: ['零基础', '涂鸦期 (3-5岁)', '造型期 (6-8岁)', '创意期 (9-12岁)', '专业备考'],
    auditLevels: ['普通', '紧急', '非常紧急', '暂缓'],
    referrerId: '',
    referrerDisplay: '',
    fromShare: false,
    
    formData: { 
      name: '',
      phone: '',
      age: '',
      level: '', 
      note: ''
    }
  },

  onLoad: function(options) {
    options = options || {};
    const referrer = (options.referrer && String(options.referrer).trim()) || '';
    const fromShare = options.from === 'share' || !!referrer;
    const referrerDisplay = referrer ? '已填写（来自分享）' : '';
    this.setData({ referrerId: referrer, referrerDisplay: referrerDisplay, fromShare: fromShare });
    if (referrer || fromShare) {
      wx.setStorageSync('enroll_from_share', true);
    }
    if (referrer) {
      console.log('检测到推荐人:', referrer);
      this.fetchReferrerName(referrer);
    }
  },
  fetchReferrerName: function(studentId) {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Students', id: studentId }
    }).then(res => {
      if (res.result && res.result.data && res.result.data.name) {
        this.setData({ referrerDisplay: res.result.data.name });
      }
    }).catch(() => {});
  },

  onShow: function() {
    // 0. 【分享入口】用同步存储判断，避免 onShow 早于 setData 生效导致误走审核员
    if (wx.getStorageSync('enroll_from_share')) {
      wx.removeStorageSync('enroll_from_share');
      this.setData({ isAudit: false });
      wx.setStorageSync('isAuditMode', false);
      return;
    }
    if (this.data.referrerId || this.data.fromShare) {
      this.setData({ isAudit: false });
      wx.setStorageSync('isAuditMode', false);
      return;
    }

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
   

  onInput(e) {
    let field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  onLevelChange(e) {
    const idx = e.detail.value;
    const list = this.data.isAudit ? this.data.auditLevels : this.data.realLevels;
    this.setData({ 'formData.level': list[idx] });
  },

  async submitEnroll() {
    const f = this.data.formData;
    if(!f.name || !f.phone) return wx.showToast({ title: '前两项必填', icon: 'none' });

    // A面：审核模式
    if (this.data.isAudit) {
      let list = wx.getStorageSync('audit_todos') || [];
      list.push({ ...f, _id: Date.now(), status: 'pending' });
      wx.setStorageSync('audit_todos', list);
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    // B面：真实模式
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'add',
          collection: 'Prospective_students',
          data: { 
            ...f, 
            status: 'pending',
            source: '教师录入',
            referrer_id: this.data.referrerId, // 【关键】保存推荐人ID
            createTime: wx.cloud.database().serverDate()
          }
        }
      });
      wx.hideLoading();
      wx.showModal({
        title: '提交成功',
        content: this.data.referrerId ? '意向已录入，系统已记录推荐人信息。' : '已录入意向名单。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch(e) { 
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
})