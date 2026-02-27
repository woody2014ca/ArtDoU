// pages/editStudent/editStudent.js
const app = getApp();
Page({
  data: {
    loadingStudent: true,
    student: { name: '', phone: '', left_classes: '' },
    studentId: '',
    isAudit: true,
    parentOpenid: '',
  },

  onParentOpenidInput(e) { this.setData({ parentOpenid: (e.detail.value || '').trim() }); },

  setParentByOpenid() {
    const { studentId, parentOpenid } = this.data;
    if (!parentOpenid) return wx.showToast({ title: '请粘贴家长的 OpenID', icon: 'none' });
    wx.showLoading({ title: '设置中...', mask: true });
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'setParentByOpenid', studentId, openid: parentOpenid }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '已设为该学员家长', icon: 'success' });
        this.setData({ parentOpenid: '' });
      } else {
        wx.showToast({ title: res.result && res.result.msg ? res.result.msg : '设置失败', icon: 'none' });
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }); });
  },

  /** 老学员补开家长绑定：允许该学员的家长用「家长电话」在首页绑定手机号登录 */
  openParentBind() {
    const studentId = this.data.studentId;
    const phone = (this.data.student.phone || this.data.student.parent_phone || '').trim();
    if (!phone) return wx.showToast({ title: '请先填写家长电话并保存', icon: 'none' });
    wx.showModal({
      title: '开放家长绑定',
      content: '开放后，该学员的家长可用上述手机号在小程序首页「我是家长，绑定手机号」登录。确认开放？',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '设置中...', mask: true });
        wx.cloud.callFunction({
          name: 'manageData',
          data: {
            action: 'update',
            collection: 'Students',
            id: studentId,
            data: { parent_activated: true, parent_phone: phone }
          }
        }).then(r => {
          wx.hideLoading();
          if (r.result && r.result.success === false) {
            wx.showToast({ title: (r.result.msg) || '设置失败', icon: 'none' });
          } else {
            wx.showToast({ title: '已开放，家长可用该手机号绑定', icon: 'success' });
          }
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }); });
      }
    });
  },
  
  _debugStudent(tag) {
    const s = this.data.student || {}
    console.log(`[editStudent][${tag}] studentId=`, this.data.studentId, 'name=', s.name, 'student=', s)
  },
  onLoad(options) {
    if (options.id) {
      this.setData({
        studentId: options.id,
        loadingStudent: true,
        student: { name: '', phone: '', left_classes: '' }
      }, () => {
        this.fetchStudent()
      })
    }
  },
  onShow: function() {
    // 同步全局开关
    this._debugStudent('onShow')
    if (typeof app.globalData.isAuditMode !== 'undefined') {
      this.setData({ isAudit: app.globalData.isAuditMode });
    }
  },

  onShareAppMessage() {
    const id = this.data.studentId;
    const name = (this.data.student && this.data.student.name) || '学员';
    return {
      title: `${name} 的缴费链接`,
      path: `pages/payment/payment?id=${id}&name=${encodeURIComponent(name)}`
    };
  },

  /**
   * 1. 拉取当前学员信息（云函数版）
   */
  /** 复制缴费说明（发给家长的文字，非链接） */
  copyPaymentLink() {
    const name = (this.data.student && this.data.student.name) || '学员';
    const text = `【ArtDoU 缴费】请家长打开本小程序，在首页点击「意向学员缴费」，输入学员姓名：${name}，及您登记的手机号，即可提交缴费凭证。老师确认后会自动增加课时。`;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制缴费说明，可粘贴发给家长', icon: 'none' })
    });
  },

  fetchStudent() {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Students', id: this.data.studentId },
      success: res => {
        if (res.result && res.result.data) {
          this.setData({ student: res.result.data }, () => {
            this.setData({ loadingStudent: false })
          })
        } else {
          this.setData({ loadingStudent: false })
        }
      },
      fail: () => {
        this.setData({ loadingStudent: false })
      }
    })
  },
  
  

  // 监听输入（剩余课时允许负数，仅允许数字和开头一个负号）
  onInput: function(e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (field === 'left_classes') {
      value = value.replace(/[^\d-]/g, '');
      if (value.indexOf('-') > 0) value = value.replace(/-/g, '');
      if ((value.match(/-/g) || []).length > 1) value = value.replace(/-/g, '').replace(/^/, '-');
    }
    const student = { ...this.data.student, [field]: value };
    this.setData({ student });
  },

  /**
   * 2. 提交更新（云函数版）
   */
  updateStudent: async function() {
    const { name, phone, left_classes } = this.data.student;
    
    if (!name) return wx.showToast({ title: '姓名不能为空', icon: 'none' });

    wx.showLoading({ title: '正在更新...', mask: true });
    const parentPhone = (phone || this.data.student.parent_phone || '').trim();
    
    wx.cloud.callFunction({
      name: 'manageData',
      data: {
        action: 'update',
        collection: 'Students',
        id: this.data.studentId,
        data: {
          name: name,
          phone: phone,
          parent_phone: parentPhone,
          left_classes: parseInt(left_classes)
        }
      },
      success: res => {
        if (res.result && res.result.success === false) {
          wx.showToast({ title: res.result.msg, icon: 'none' });
        } else {
          wx.showToast({ title: '更新成功' });
          setTimeout(() => wx.navigateBack(), 1000);
        }
      },
      fail: err => {
        wx.showToast({ title: '系统错误', icon: 'none' });
      },
      complete: () => wx.hideLoading()
    });
  },

  /**
   * 3. 删除学员逻辑（云函数版）
   */
  deleteStudent: function() {
    wx.showModal({
      title: '极其重要',
      content: `确定要永久删除学员 [ ${this.data.student.name} ] 吗？该操作不可撤销！`,
      confirmColor: '#FF4D4F',
      cancelText: '取消',
      confirmText: '确定删除',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在删除...' });
          
          wx.cloud.callFunction({
            name: 'manageData',
            data: {
              action: 'delete',
              collection: 'Students',
              id: this.data.studentId
            },
            success: result => {
              if (result.result && result.result.success === false) {
                wx.showToast({ title: result.result.msg, icon: 'none' });
              } else {
                wx.showToast({ title: '已成功删除' });
                // 删除后必须回到首页刷新
                setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1000);
              }
            },
            fail: err => {
              wx.showToast({ title: '删除失败', icon: 'none' });
            },
            complete: () => wx.hideLoading()
          });
        }
      }
    });
  }
})