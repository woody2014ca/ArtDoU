// pages/auditEdit/auditEdit.js - 审核员编辑项目：修改项目名称、供应商编号、入库数量
Page({
  data: {
    id: '',
    name: '',
    contact: '',
    left: ''
  },

  onLoad(options) {
    const id = options.id || '';
    const name = decodeURIComponent(options.name || '');
    const left = options.left != null ? String(options.left) : '';
    let contact = '';
    const list = wx.getStorageSync('audit_assets') || [];
    const item = Array.isArray(list) ? list.find(i => i._id === id) : null;
    if (item) {
      contact = item.contact != null ? String(item.contact) : (item.phone != null ? String(item.phone) : '');
    }
    this.setData({ id, name, contact, left });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onContactInput(e) { this.setData({ contact: e.detail.value }); },
  onLeftInput(e) { this.setData({ left: e.detail.value }); },

  submit() {
    const { id, name, left } = this.data;
    if (!id) return wx.showToast({ title: '无效项目', icon: 'none' });
    const num = parseInt(left, 10);
    if (isNaN(num) || num < 0) return wx.showToast({ title: '请输入有效数量', icon: 'none' });

    const list = wx.getStorageSync('audit_assets') || [];
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex(i => i._id === id);
    if (idx === -1) return wx.showToast({ title: '未找到该项目', icon: 'none' });

    arr[idx] = {
      ...arr[idx],
      name: (name || '').trim() || arr[idx].name,
      contact: (this.data.contact || '').trim(),
      left_classes: num
    };
    wx.setStorageSync('audit_assets', arr);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  }
});
