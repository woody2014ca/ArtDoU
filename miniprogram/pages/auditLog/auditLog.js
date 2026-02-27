// pages/auditLog/auditLog.js - 审核员耗材记录：输入数量+单位，增加或减少余量
Page({
  data: {
    id: '',
    name: '',
    currentLeft: 0,
    amount: '',
    unit: '件',
    operation: 'add' // 'add' | 'minus'
  },

  onLoad(options) {
    const left = parseInt(options.left, 10) || 0;
    this.setData({
      id: options.id || '',
      name: decodeURIComponent(options.name || ''),
      currentLeft: left
    });
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }); },
  onUnitInput(e) { this.setData({ unit: e.detail.value || '件' }); },
  setOperation(e) { this.setData({ operation: e.currentTarget.dataset.op }); },

  submit() {
    const { id, currentLeft, amount, unit, operation } = this.data;
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) {
      return wx.showToast({ title: '请输入有效数量', icon: 'none' });
    }
    let newLeft = operation === 'add' ? currentLeft + num : currentLeft - num;
    if (newLeft < 0) newLeft = 0;

    const list = wx.getStorageSync('audit_assets') || [];
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(i => i._id === id);
    if (idx === -1) {
      wx.showToast({ title: '未找到该类目', icon: 'none' });
      return;
    }
    arr[idx] = { ...arr[idx], left_classes: newLeft };
    wx.setStorageSync('audit_assets', arr);

    const opText = operation === 'add' ? '增加' : '减少';
    wx.showToast({ title: `已${opText} ${num}${unit}`, icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
