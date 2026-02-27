// pages/findStudentToPay/findStudentToPay.js - 准家长凭学员姓名+家长手机号查找后去缴费
Page({
  data: {
    studentName: '',
    phone: '',
    loading: false
  },

  onStudentNameInput(e) { this.setData({ studentName: (e.detail.value || '').trim() }) },
  onPhoneInput(e) { this.setData({ phone: (e.detail.value || '').trim() }) },

  goBack() { wx.navigateBack() },

  async findAndGoPay() {
    const { studentName, phone } = this.data
    if (!phone) return wx.showToast({ title: '请输入家长手机号', icon: 'none' })
    if (phone.replace(/\D/g, '').length < 8) return wx.showToast({ title: '手机号格式有误', icon: 'none' })

    this.setData({ loading: true })
    wx.showLoading({ title: '查找中...', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'findStudentForPayment',
          phone: phone,
          studentName: studentName || undefined
        }
      })
      wx.hideLoading()
      this.setData({ loading: false })

      const r = res.result
      if (r && r.success) {
        const name = encodeURIComponent(r.studentName || '学员')
        if (r.isProspective && r.prospectiveId) {
          wx.navigateTo({ url: `/pages/payment/payment?prospectiveId=${r.prospectiveId}&name=${name}` })
        } else if (r.studentId) {
          wx.navigateTo({ url: `/pages/payment/payment?id=${r.studentId}&name=${name}` })
        } else {
          wx.showToast({ title: '未找到学员', icon: 'none' })
        }
      } else {
        wx.showToast({ title: (r && r.msg) ? r.msg : '未找到学员', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  }
})
