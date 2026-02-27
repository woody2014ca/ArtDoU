// pages/parentHome/parentHome.js 
const app = getApp();
const RAL_5005 = '#005387'; 

Page({
  data: {
    student: {},
    works: [],
    loading: true,
    isAuthorized: false,
    canvasHeight: 1000,
    isAudit: false,       
    targetStudentId: '',
    isAdmin: false,
    highlightShare: false, 
    isGuest: false, 
    referrerId: '',
    isViewingSharedLink: false
  },

  onShow: function() {
    console.log('页面显示，开始检查权限...');
    wx.cloud.callFunction({ name: 'manageData', data: { action: 'init' } })
      .then(res => {
        const role = res.result.role;
        console.log('云函数返回角色:', role);
        
        let shouldAudit = true; 
        if (role === 'parent' || role === 'admin' || role === 'teacher') {
            shouldAudit = false; 
        }

        if (role === 'guest' && this.data.targetStudentId) {
            shouldAudit = false;
            this.setData({ isGuest: true, isViewingSharedLink: true });
        }

        if (this.data.isAudit !== shouldAudit) {
          this.setData({ isAudit: shouldAudit });
          wx.setStorageSync('isAuditMode', shouldAudit);
        }
        
        if (!shouldAudit) {
            if (!this.data.student.name || this.data.student.name === '专业版帐户') {
                this.checkAccess(); 
            }
        }
      }).catch(err => {
          console.error('云函数调用失败', err);
      });
  },

  onLoad: function (options) {
    this.setData({ targetStudentId: options.id || '' });
    
    if (options.referrer) {
      this.setData({ referrerId: options.referrer });
    }

    let isAudit = true;
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (cachedMode === false) isAudit = false;

    if (options.id && options.referrer) {
      isAudit = false; 
      this.setData({ 
          targetStudentId: options.id,
          isGuest: true,      
          isViewingSharedLink: true,
          isAdmin: false,     
          isAuthorized: true, 
          isAudit: false,     
          loading: false
      });
      this.loadAllData(options.id);
      return; 
    }

    this.setData({ isAudit: isAudit });
    this.checkAccess();

    if (options.showShare === 'true') {
        setTimeout(() => {
            wx.showModal({
                title: '消课成功',
                content: '作品已归档！是否立即发送给家长？',
                confirmText: '去发送',
                cancelText: '暂不',
                success: (res) => {
                    if (res.confirm) {
                        this.setData({ highlightShare: true });
                    }
                }
            });
        }, 1000);
    }

    setTimeout(() => {
      if (this.data.loading) this.setData({ loading: false });
    }, 3000);
  },
    
  checkAccess: async function() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'manageData',
        data: { action: 'init' }
      });
      
      const role = res.result.role;
      if (role === 'guest') {
        this.setData({ 
            isGuest: true,
            isViewingSharedLink: !!this.data.targetStudentId,
            isAudit: false, 
            isAuthorized: true, 
            loading: false
        });
        this.loadAllData(); 
        return;
      }

      const myStudentId = res.result.myStudentId;
      const cachedAudit = wx.getStorageSync('isAuditMode');

      if (role === 'guest' || cachedAudit === true) {
        this.loadFakeAuditData();
        return; 
      }

      let hasAccess = false;
      if (role === 'admin' || role === 'teacher' || role === 'parent' || role === 'user') {
        hasAccess = true;
        if ((role === 'parent' || role === 'user') && !this.data.targetStudentId) {
          this.setData({ targetStudentId: myStudentId });
        }
      }

      if (hasAccess) {
        this.setData({ 
          isAuthorized: true, 
          isAudit: false, 
          isAdmin: (role === 'admin'),
          loading: false 
        });
        this.loadAllData(); 
      } else {
        this.setData({ isAuthorized: false, loading: false });
      }
    } catch (e) {
      console.error('鉴权异常:', e);
      this.loadFakeAuditData();
    }
  }, 
  
  loadFakeAuditData() {
    this.setData({
      isAuthorized: true,
      loading: false,
      isAudit: true, 
      student: { name: '固定资产/演示', left_classes: 1250 },
      works: [],
      totalRewards: 88
    });
    wx.setStorageSync('isAuditMode', true);
  },

  generatePoster: function() {
    const sid = (this.data.student && this.data.student._id) || this.data.targetStudentId;
    if (!sid) return wx.showToast({ title: '无法获取学生ID', icon: 'none' });
    wx.navigateTo({ url: `/pages/poster/poster?id=${sid}` });
  },

  async loadAllData(overrideStudentId) {
    const sid = overrideStudentId != null ? overrideStudentId : this.data.targetStudentId;
    if (!sid) {
      this.setData({ loading: false });
      return;
    }
    try {
      const [sRes, aRes] = await Promise.all([
        wx.cloud.callFunction({ 
          name: 'manageData', 
          data: { action: 'get', collection: 'Students', id: sid } 
        }),
        wx.cloud.callFunction({ 
          name: 'manageData', 
          data: { 
              action: 'get', 
              collection: 'Attendance_logs', 
              id: 'all',
              search_student_id: sid 
          } 
        })
      ]);

      const currentStudent = sRes.result.data || {};
      const allLogs = aRes.result.data || [];
      
      let studentWorks = allLogs.filter(i => 
        i.student_id === sid && (i.work_img || i.work_photo || (i.work_imgs && i.work_imgs.length > 0))
      );

      // --- 关键修复：日期格式化 ---
      studentWorks = studentWorks.map(item => {
        let displayDate = item.date; 
        try {
            // 1. 替换横杠为斜杠 (兼容 iOS)
            let safeDateStr = String(item.date).replace(/-/g, '/');
            
            // 2. 尝试解析
            let d = new Date(safeDateStr);
            
            // 3. 这里的 new Date 是安全的，因为格式已被清洗
            if (isNaN(d.getTime())) {
                // 如果是特殊英文格式 "Sat Jan 10..."，尝试直接 Date.parse 或 fallback
                d = new Date(); 
            }

            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            const h = d.getHours().toString().padStart(2, '0');
            const min = d.getMinutes().toString().padStart(2, '0');
            displayDate = `${y}/${m}/${day} ${h}:${min}`;
            
        } catch(e) {
            console.error('日期解析出错:', e);
        }
        return { ...item, date: displayDate }; 
      });
      // ------------------------

      const totalRewards = (allLogs || []).filter(i => i.student_id === sid && (i.type === 'reward' || (i.lessons_deducted != null && i.lessons_deducted < 0))).length;
      this.setData({
        student: currentStudent,
        works: studentWorks.sort((a, b) => new Date(b.date) - new Date(a.date)),
        totalRewards,
        loading: false
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  onShareAppMessage: function () {
    const works = this.data.works;
    const latestImg = works.length > 0 ? (works[0].work_img || works[0].work_photo) : '';
    const studentName = this.data.student.name || '学员';
    const myId = this.data.targetStudentId;
    
    return {
      title: `邀请你参观 ${studentName} 的 ArtDoU 艺术展厅！`,
      path: `/pages/parentHome/parentHome?id=${myId}&referrer=${myId}`,
      imageUrl: latestImg
    }
  },

  goToLeave: function() {
    const id = this.data.targetStudentId;
    const name = encodeURIComponent(this.data.student.name || '学员');
    wx.navigateTo({ url: `/pages/leaveRequest/leaveRequest?id=${id}&name=${name}` });
  },

  goToEnroll: function() {
    const refId = this.data.referrerId || this.data.targetStudentId;
    wx.navigateTo({ url: `/pages/enroll/enroll?referrer=${refId || ''}&from=share` });
  },

  previewImage: function(e) {
    const idx = e.currentTarget.dataset.index;
    const item = (this.data.works || [])[idx];
    if (!item) return;
    const urls = (item.work_imgs && item.work_imgs.length > 0) ? item.work_imgs : (item.work_img || item.work_photo ? [item.work_img || item.work_photo] : []);
    const current = e.currentTarget.dataset.src || urls[0];
    if (urls.length) wx.previewImage({ current, urls });
  }
});