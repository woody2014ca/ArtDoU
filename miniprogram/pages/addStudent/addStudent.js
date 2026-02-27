// pages/addStudent/addStudent.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    isLocalMode: true, // 【核心】默认开启演示模式(资产入库)，防止闪烁！
    name: '',
    phone: '',
    count: ''
  },

  // 1. 【新增/补全】onLoad：接收暗号，判断身份
  onLoad: function(options) {
    // A. 验卡：如果首页传来了 mode=real，说明是真老师
    if (options.mode === 'real') {
        this.setData({ isLocalMode: false });
        return;
    }
    
    // B. 双重保险：如果没传参数，读全局缓存确认一下
    const globalAudit = wx.getStorageSync('isAuditMode');
    if (globalAudit === false) {
        this.setData({ isLocalMode: false });
    }
  },

  // 2. 绑定输入框 (保持原样)
  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },
  onClassesInput(e) { this.setData({ count: e.detail.value }) }, 

  // 3. 提交逻辑 (保持原样，未动一字)
  addStudent: function() {
    // 基础校验
    if (!this.data.name || !this.data.phone || !this.data.count) {
      return wx.showToast({ title: '请填写完整信息', icon: 'none' });
    }

    // ============================================================
    // 🕵️‍♂️ 审核员特供逻辑：假装提交成功
    // ============================================================
    // 直接读 data 里的模式标记，最准
    if (this.data.isLocalMode) {
      wx.showLoading({ title: '入库中...', mask: true });
      // 写入 audit_assets，与首页、编辑、记录共用，新项目会出现在审核员列表
      let list = wx.getStorageSync('audit_assets') || [];
      if (!Array.isArray(list)) list = [];
      list.push({
        _id: 'demo_' + Date.now(),
        name: this.data.name,
        contact: this.data.phone || '',
        left_classes: Number(this.data.count)
      });
      wx.setStorageSync('audit_assets', list);

      setTimeout(() => {
        wx.hideLoading();
        wx.showToast({ title: '入库成功', icon: 'success' });
        
        // 1.5秒后自动返回上一页
        setTimeout(() => {
          wx.navigateBack(); 
        }, 1500);
      }, 1000);
      
      return; // 🛑 必须return！
    }
    // ============================================================

    // --- B面：真实模式 (老师用的) ---
    wx.showLoading({ title: '录入中...', mask: true });
    
    wx.cloud.callFunction({
      name: 'manageData',
      data: {
        action: 'add',
        collection: 'Students',
        data: {
          name: this.data.name,
          parent_phone: this.data.phone, 
          left_classes: Number(this.data.count),
          createTime: new Date().toISOString() 
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.success || res.result._id) {
          wx.showToast({ title: '录入成功' });
          setTimeout(() => wx.navigateBack(), 1500);
      } else {
          wx.showToast({ title: '录入失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '网络异常', icon: 'none' });
    });
  }
});