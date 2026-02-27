// pages/paymentManage/paymentManage.js
const app = getApp();
Page({
  data: {
    pendingPayments: [],
    loading: true,
    isAudit: true,
  },

  onLoad: function (options) {
    // 从财务页「待确认缴费」进入时强制教师端，不显示审核员文案
    const fromTeacher = options.from === 'teacher';
    this.setData({
      isAudit: fromTeacher ? false : (app.globalData.isAuditMode !== false)
    });
  },

  onShow: function () {
    // 非从财务进入时（如直接打开）再按全局审核状态刷新
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    const fromTeacher = cur.options && cur.options.from === 'teacher';
    if (!fromTeacher && typeof app.globalData.isAuditMode !== 'undefined') {
      this.setData({ isAudit: app.globalData.isAuditMode });
    }
    this.fetchPayments();
  },

  /**
   * 1. 获取所有待核销记录
   * 通过云函数代理，获取后在前端过滤 pending 状态
   */
  fetchPayments: function () {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'manageData',
      data: {
        action: 'get',
        collection: 'Payment_logs',
        id: 'all'
      },
      success: res => {
        if (!res.result || res.result.success === false) {
          this.setData({ pendingPayments: [], loading: false });
          return;
        }
        if (res.result && res.result.data) {
          // 过滤待确认记录并格式化日期
          const list = res.result.data
            .filter(item => item.status === 'pending')
            .map(item => {
              let timeStr = "近期提交";
              if (item.create_time) {
                const date = new Date(item.create_time);
                timeStr = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
              }
              return { ...item, displayTime: timeStr };
            });
          
          // 按提交时间从新到旧排序
          list.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
          
          this.setData({ 
            pendingPayments: list,
            loading: false 
          });
        }
      },
      fail: err => {
        console.error("财务记录加载失败", err);
        this.setData({ loading: false });
      }
    });
  },

  /**
   * 2. 核心逻辑：确认入账并自动加课
   * 连续调用云函数，确保流程原子化
   */
  /** 意向学员：确认入账并转为正式学员 */
  confirmProspectivePayment: function (e) {
    const item = e.currentTarget.dataset.item;
    if (this.data.isAudit || !item.prospective_id) return;
    wx.showModal({
      title: '确认入账并转正',
      content: `确认为意向学员「${item.student_name}」入账 ￥${item.price}，增加 ${item.amount_lessons} 课时，并转为正式学员吗？`,
      confirmColor: '#005387',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '办理中...', mask: true });
        try {
          await wx.cloud.callFunction({
            name: 'manageData',
            data: {
              action: 'confirmProspectivePayment',
              paymentId: item._id,
              prospectiveId: item.prospective_id
            }
          });
          wx.hideLoading();
          wx.showToast({ title: '已转正并入账', icon: 'success' });
          this.fetchPayments();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
      }
    });
  },

  confirmPayment: function (e) {
    const item = e.currentTarget.dataset.item;
    if (this.data.isAudit) {
      wx.showToast({ title: '操作成功', icon: 'success' });
      return;
    }
    if (item.prospective_id) {
      this.confirmProspectivePayment(e);
      return;
    }
    wx.showModal({
      title: '入账确认',
      content: `确认收到 ${item.student_name} 的缴费 ￥${item.price} 并增加 ${item.amount_lessons} 节课时吗？`,
      confirmColor: '#005387', // RAL 5005 信号蓝
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在核销入账...', mask: true });

          try {
            // 动作 A：通过云函数给学员加课
            await wx.cloud.callFunction({
              name: 'manageData',
              data: {
                action: 'increment',
                collection: 'Students',
                id: item.student_id,
                data: { value: Number(item.amount_lessons) }
              }
            });

            // 动作 B：通过云函数将缴费记录状态改为“已确认”
            await wx.cloud.callFunction({
              name: 'manageData',
              data: {
                action: 'update',
                collection: 'Payment_logs',
                id: item._id,
                data: { 
                  status: 'confirmed', 
                  confirm_time: new Date().toLocaleString() 
                }
              }
            });

            // 动作 C：通过云函数生成对账流水 (Attendance_logs)
            await wx.cloud.callFunction({
              name: 'manageData',
              data: {
                action: 'add',
                collection: 'Attendance_logs',
                data: {
                  student_id: item.student_id,
                  student_name: item.student_name,
                  date: new Date().toLocaleDateString(),
                  type: 'topup', 
                  note: `续费核销：￥${item.price} / +${item.amount_lessons}课时`,
                  lessons_deducted: -Number(item.amount_lessons) // 负数代表增加
                }
              }
            });

            // 动作 D：将该学员标记为“已缴费家长可绑定”，家长可凭手机号绑定
            await wx.cloud.callFunction({
              name: 'manageData',
              data: {
                action: 'update',
                collection: 'Students',
                id: item.student_id,
                data: { parent_activated: true }
              }
            });

            wx.hideLoading();
            wx.showToast({ title: '核销成功', icon: 'success' });
            
            // 刷新列表，移除已处理项
            this.fetchPayments();

          } catch (err) {
            console.error("核销流程异常：", err);
            wx.hideLoading();
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          }
        }
      }
    });
  },

  // 预览大图（缴费凭证）
  previewProof: function(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({ current: url, urls: [url] });
    }
  }
});