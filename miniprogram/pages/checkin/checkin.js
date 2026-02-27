// pages/checkin/checkin.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    id: '',
    name: '',
    count: '1',
    remark: '',
    imgUrl: '',      // ✅ 保留：给你现有WXML预览/占位用
    imgUrls: [],     // ✅ 新增：多张图临时路径数组
    brief: '',
    memo: '',
    isLocalMode: true
  },
  

  onLoad(options) {
    // 1. 核心判断：如果 ID 不包含 'demo'，那就是真学生！
    // (审核员的假数据 ID 都是 demo1, demo2)
    const isRealStudent = options.id && !options.id.startsWith('demo');

    this.setData({ 
      id: options.id,
      name: options.name || '项目',
      isLocalMode: !isRealStudent, // 真学生 -> localMode=false
      loading: false
    });
    
    // 2. 如果是真学生，去查名字
    if (isRealStudent) {
      this.fetchStudentName();
    }
  },

  // 查名字
  fetchStudentName() {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Students', id: this.data.id }
    }).then(res => {
      if (res.result.data) this.setData({ name: res.result.data.name });
    });
  },

  // 输入绑定
  onCountInput(e) { this.setData({ count: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },
  onBriefInput(e) {
    this.setData({ brief: e.detail.value });
  },
  onMemoInput(e) {
    this.setData({ memo: e.detail.value });
  },
    // 海报“精选一句”：取第一句 + 限长
    makePosterNote(text) {
      const s = String(text || '').trim();
      if (!s) return '';
      const first = s.split(/[\n。！？!?\r]/).filter(Boolean)[0] || s;
      return first.length > 24 ? first.slice(0, 24) + '…' : first;
    },
  

  // 选图（✅ 支持多次追加，且不破坏原来 imgUrl 的显示逻辑）
chooseImage() {
  const existing = this.data.imgUrls || [];
  const remain = 9 - existing.length;

  if (remain <= 0) {
    wx.showToast({ title: '最多上传9张', icon: 'none' });
    return;
  }

  wx.chooseImage({
    count: remain, // ✅ 剩余可选数量
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const newPaths = (res.tempFilePaths || []).filter(Boolean);
      if (!newPaths.length) return;

      const merged = existing.concat(newPaths);

      this.setData({
        imgUrls: merged,      // ✅ 多图追加
        imgUrl: merged[0]     // ✅ 保持旧UI继续能显示（用第一张占位）
      });
    }
  });
},


  // 提交
  async submit() {
    if (!this.data.count) return wx.showToast({title:'请输入数量', icon:'none'});

    // --- A. 审核员/本地模式 ---
    if (this.data.isLocalMode) {
      wx.showToast({ title: '核销成功' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    // --- B. 真实消课模式 ---
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      let fileID = '';
      let fileIDs = [];

      // 1. 如果有图，先上传（手机端上传易超时/失败，失败时仍继续提交仅文字记录）
      const imgs =
        (this.data.imgUrls && this.data.imgUrls.length > 0)
          ? this.data.imgUrls
          : (this.data.imgUrl ? [this.data.imgUrl] : []);

      if (imgs.length > 0) {
        try {
          const uploadTasks = imgs.map((fp) => {
            const cloudPath = `works/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
            return wx.cloud.uploadFile({ cloudPath, filePath: fp });
          });
          const uploadResults = await Promise.all(uploadTasks);
          fileIDs = uploadResults.map(r => r.fileID).filter(Boolean);
          fileID = fileIDs[0] || '';
        } catch (uploadErr) {
          console.warn('图片上传失败（手机端常见），先提交消课记录', uploadErr);
          wx.showToast({ title: '图片上传失败，先保存消课，可稍后在财务中编辑补图', icon: 'none', duration: 2500 });
        }
      }

      // 2. 写入日志表 (包含图片ID)
      const addRes = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'add',
          collection: 'Attendance_logs',
          data: {
            student_id: this.data.id,
            student_name: this.data.name,
            change_num: -Number(this.data.count),
            work_img: fileID,
            work_imgs: fileIDs.length > 0 ? fileIDs : (fileID ? [fileID] : []),
            teacher_notes: this.data.remark || '',
            brief: this.data.brief || '',
            memo: this.data.memo || '',
            note: this.makePosterNote(this.data.brief || this.data.remark || ''),
            date: new Date().toISOString()
          }
        }
      });
      if (addRes.result && addRes.result.success === false) {
        wx.hideLoading();
        wx.showToast({ title: addRes.result.msg || addRes.result.error || '写入记录失败', icon: 'none', duration: 3000 });
        return;
      }

      // 3. 扣减余额
      const incRes = await wx.cloud.callFunction({
        name: 'manageData',
        data: {
          action: 'increment',
          collection: 'Students',
          id: this.data.id,
          data: { value: -Number(this.data.count) }
        }
      });
      if (incRes.result && incRes.result.success === false) {
        wx.hideLoading();
        wx.showToast({ title: incRes.result.msg || incRes.result.error || '扣减课时失败', icon: 'none', duration: 3000 });
        return;
      }

      wx.hideLoading();
      wx.redirectTo({
        url: `/pages/parentHome/parentHome?id=${this.data.id}&showShare=true`
      });

    } catch (err) {
      console.error('消课提交异常', err);
      wx.hideLoading();
      let msg = (err.errMsg || err.message || (err.result && (err.result.msg || err.result.error)) || '');
      if (!msg) msg = '网络或服务异常，请检查手机网络后重试';
      if (msg.length > 24) msg = '提交失败，请检查网络后重试';
      wx.showToast({ title: msg, icon: 'none', duration: 3500 });
    }
  }
});
