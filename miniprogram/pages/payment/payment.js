// pages/payment/payment.js - ArtDoU 家长端重构版
const app = getApp();
Page({
  data: {
    studentId: '',
    prospectiveId: '',
    studentName: '',
    lessons: '',
    price: '',
    tempImagePath: '',
    submitting: false,
    isAudit: true,
    isPaymentLink: false,  // 从老师分享的缴费链接进入时 true，只显示家长缴费表单
  },

  onShow: function () {
    if (this.data.isPaymentLink) return;
    if (typeof app.globalData.isAuditMode !== 'undefined') {
      this.setData({ isAudit: app.globalData.isAuditMode });
    }
  },

  onLoad: function(options) {
    options = options || {};
    const name = decodeURIComponent(options.name || '学员');
    const hasPaymentParams = !!(options.id || options.prospectiveId);
    if (options.prospectiveId) {
      this.setData({ prospectiveId: options.prospectiveId, studentName: name, isPaymentLink: true });
    } else if (options.id) {
      this.setData({ studentId: options.id, studentName: name, isPaymentLink: true });
    } else {
      this.setData({ studentId: options.id || '', studentName: name, isPaymentLink: false });
    }
    if (hasPaymentParams) this.setData({ isAudit: false });
  },

  onInput: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },
  onCommentInput: function(e) {
    this.setData({ settlementRemarks: e.detail.value });
  },
  submitCheckin: function() {
    wx.showToast({ title: '请到消课/财务页操作', icon: 'none' });
  },

  /**
   * 选择凭证图片
   */
  chooseImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ tempImagePath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  /**
   * 提交缴费凭证 (通过 manageData 云函数代理)
   */
  submitPayment: async function() {
    const { lessons, price, tempImagePath, studentId, prospectiveId, studentName } = this.data;

    if (!lessons || !price || !tempImagePath) {
      return wx.showToast({ title: '请填写课时、金额并上传截图', icon: 'none' });
    }
    if (!studentId && !prospectiveId) {
      return wx.showToast({ title: '缺少学员信息', icon: 'none' });
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '上传中...', mask: true });

    try {
      const fileId = (studentId || prospectiveId) + '_' + Date.now();
      const cloudPath = `payments/${fileId}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempImagePath
      });

      const payload = {
        student_name: studentName,
        amount_lessons: parseInt(lessons),
        price: parseFloat(price),
        proof_img: uploadRes.fileID,
        status: 'pending',
        create_time: new Date().toISOString()
      };
      if (prospectiveId) {
        payload.prospective_id = prospectiveId;
      } else {
        payload.student_id = studentId;
      }

      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'add',
          collection: 'Payment_logs',
          data: payload
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success === false) {
        throw new Error(res.result.msg);
      }

      // 4. 成功反馈
      wx.showModal({
        title: '提交成功 / Success',
        content: '凭证已上传，老师核销后将自动增加课时。',
        showCancel: false,
        confirmColor: '#005387', // RAL 5005 信号蓝
        success: () => {
          wx.navigateBack();
        }
      });

    } catch (err) {
      console.error("缴费凭证提交异常：", err);
      wx.hideLoading();
      wx.showToast({ title: '上传失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
})