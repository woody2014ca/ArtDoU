// pages/enrollList/enrollList.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    enrollList: [],
    showModal: false,
    activeItem: null,
    initialLessons: 0,
    loading: true,
    isAudit: true, 
    discountTip: '' 
  }, // <--- data 在这里闭合

  // --- 【关键修复】deleteEnroll 放在这里！ ---
  deleteEnroll: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 审核模式
          if (this.data.isAudit) {
            let list = wx.getStorageSync('audit_todos') || [];
            list = list.filter(i => i._id !== id);
            wx.setStorageSync('audit_todos', list);
            this.fetchFakeList();
            return;
          }
          // 真实模式
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'manageData',
            data: { action: 'delete', collection: 'Prospective_students', id: id },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已删除' });
              this.fetchRealList(); 
            },
            fail: () => wx.hideLoading()
          });
        }
      }
    });
  },

  onShow: function () { 
    // 1. 优先读缓存 (防闪烁)
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (cachedMode === false) {
      this.setData({ isAudit: false });
      this.fetchRealList(); // 既然是真实模式，直接拉数据
    } else {
      // 兜底查一下
      this.checkIdentityAndLoad(); 
    }
  },

  checkIdentityAndLoad: function() {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'init' }
    }).then(res => {
      const role = res.result.role;
      if (role === 'admin') {
        this.setData({ isAudit: false });
        // 如果刚才没拉，现在拉
        if (this.data.enrollList.length === 0) this.fetchRealList();
      } else {
        this.setData({ isAudit: true });
        this.fetchFakeList();
      }
    }).catch(err => {
      this.setData({ isAudit: true });
      this.fetchFakeList();
    });
  },

  fetchRealList: function () {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Prospective_students', id: 'all' },
      success: res => {
        if (res.result && res.result.data) {
          // 过滤掉已转正的，只显示 pending
          const list = res.result.data.filter(i => i.status === 'pending');
          // 排序：最新的在上面
          list.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));
          this.setData({ enrollList: list });
        }
      },
      fail: (err) => {
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
        wx.hideLoading();
      }
    });
  },

  fetchFakeList: function () {
    const localList = wx.getStorageSync('audit_todos') || [];
    if (localList.length === 0) localList.push({ _id: 'demo_1', name: '画材采购', age: '待办', phone: '进行中' });
    this.setData({ enrollList: localList.reverse(), loading: false });
  },

  // --- 弹窗与转正逻辑 ---
  showConvertModal: function (e) {
    const item = e.currentTarget.dataset.item;
    this.setData({ showModal: true, activeItem: item, discountTip: '' });
    
    if (item.referrer_id) {
      this.setData({ discountTip: '🔍 正在核验推荐人...' });
      wx.cloud.callFunction({
        name: 'manageData',
        data: { action: 'get', collection: 'Students', id: item.referrer_id }
      }).then(res => {
        if (res.result && res.result.data) {
          const refName = res.result.data.name;
          this.setData({
            discountTip: `👤 推荐人：${refName}\n🎁 推荐人奖励：自动 +1 课时\n💰 新学员福利：首月课时费 8 折`
          });
        } else {
          this.setData({ discountTip: `⚠️ 推荐人ID无效` });
        }
      }).catch(() => {});
    }
  },

  /** 复制一段发给家长的缴费说明（意向学员用首页「意向学员缴费」） */
  copyPaymentTip: function () {
    const text = '请打开本小程序，在首页点击「意向学员缴费」，输入孩子姓名和您登记的手机号，即可提交缴费凭证。老师确认后会自动办理入学。';
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，可粘贴发给家长', icon: 'none' })
    });
  },

  closeModal: function () { this.setData({ showModal: false, discountTip: '' }); },
  onLessonInput: function (e) { this.setData({ initialLessons: parseInt(e.detail.value) || 0 }); },

  confirmConversion: async function () {
    const { activeItem, initialLessons, isAudit } = this.data;
    if (isAudit) {
      wx.showToast({ title: '操作成功' });
      this.setData({ showModal: false });
      return;
    }
    if (!initialLessons || initialLessons <= 0) return wx.showToast({ title: '请输入课时', icon: 'none' });

    wx.showLoading({ title: '办理中...' });

    try {
      let enrollNote = '正常入学';
      if (activeItem.referrer_id) enrollNote = '推荐入学 (首月8折)';

      // 1. 创建学员（直接转正也开放家长绑定：parent_activated true，准家长可用同一手机号在「家长绑定」登录）
      await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'add',
          collection: 'Students',
          data: {
            name: activeItem.name,
            age: activeItem.age,
            parent_phone: activeItem.phone,
            left_classes: initialLessons,
            enroll_date: new Date().toLocaleDateString(),
            remark: enrollNote,
            parent_activated: true,
            createTime: db.serverDate()
          }
        }
      });

      // 2. 奖励
      if (activeItem.referrer_id) {
        try {
          await wx.cloud.callFunction({
            name: 'manageData',
            data: { action: 'increment', collection: 'Students', id: activeItem.referrer_id, data: { value: 1 } }
          });
          await wx.cloud.callFunction({
            name: 'manageData',
            data: {
              action: 'add',
              collection: 'Attendance_logs',
              data: {
                student_id: activeItem.referrer_id,
                date: new Date().toLocaleDateString(),
                type: 'reward',
                note: `推荐奖励：${activeItem.name} 成功入学`,
                lessons_deducted: -1
              }
            }
          });
        } catch (e) {}
      }

      // 3. 更新状态
      await wx.cloud.callFunction({
        name: 'manageData',
        data: { action: 'update', collection: 'Prospective_students', id: activeItem._id, data: { status: 'converted' } }
      });

      wx.hideLoading();
      wx.showToast({ title: '办理成功' });
      this.setData({ showModal: false });
      this.fetchRealList(); // 刷新

    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '失败', icon: 'none' });
    }
  }
})