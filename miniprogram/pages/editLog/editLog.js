// pages/editLog/editLog.js - 教师端编辑某条消课记录（点评、图片）
Page({
  data: {
    logId: '',
    log: {},
    brief: '',
    memo: '',
    imgUrl: '',
    imgUrls: [],
    loading: true
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.setData({ logId: id });
    this.fetchLog(id);
  },

  fetchLog(id) {
    wx.cloud.callFunction({
      name: 'manageData',
      data: { action: 'get', collection: 'Attendance_logs', id }
    }).then(res => {
      const log = res.result && res.result.data ? res.result.data : null;
      if (!log) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const brief = log.brief || '';
      const memo = log.memo || log.teacher_notes || '';
      const imgUrls = (log.work_imgs && log.work_imgs.length > 0) ? log.work_imgs : (log.work_img || log.work_photo ? [log.work_img || log.work_photo] : []);
      const imgUrl = imgUrls[0] || '';
      this.setData({
        log: { ...log, date: (log.date || '').substring(0, 10) },
        brief,
        memo,
        imgUrl,
        imgUrls,
        loading: false
      });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  onBriefInput(e) { this.setData({ brief: e.detail.value }); },
  onMemoInput(e) { this.setData({ memo: e.detail.value }); },

  chooseImage() {
    const existing = this.data.imgUrls || [];
    const remain = 9 - existing.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多9张', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPaths = (res.tempFilePaths || []).filter(Boolean);
        if (!newPaths.length) return;
        const merged = existing.concat(newPaths);
        this.setData({ imgUrls: merged, imgUrl: merged[0] });
      }
    });
  },

  async submit() {
    const { logId, brief, memo, imgUrls } = this.data;
    wx.showLoading({ title: '保存中...', mask: true });

    let fileID = '';
    let fileIDs = [];
    const imgs = (imgUrls && imgUrls.length > 0) ? imgUrls : [];
    const needUpload = imgs.filter(p => p && p.indexOf('cloud://') !== 0 && p.indexOf('http') !== 0);
    const existingCloud = imgs.filter(p => p && (p.indexOf('cloud://') === 0 || p.indexOf('http') === 0));

    if (needUpload.length > 0) {
      const uploadTasks = needUpload.map((fp) => {
        const cloudPath = `works/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        return wx.cloud.uploadFile({ cloudPath, filePath: fp });
      });
      const results = await Promise.all(uploadTasks);
      fileIDs = existingCloud.concat(results.map(r => r.fileID).filter(Boolean));
    } else {
      fileIDs = existingCloud;
    }
    fileID = fileIDs[0] || '';

    const makeNote = (text) => {
      const s = String(text || '').trim();
      if (!s) return '';
      const first = (s.split(/[\n。！？!?\r]/).filter(Boolean)[0] || s);
      return first.length > 24 ? first.slice(0, 24) + '…' : first;
    };

    wx.cloud.callFunction({
      name: 'manageData',
      data: {
        action: 'update',
        collection: 'Attendance_logs',
        id: logId,
        data: {
          brief: brief || '',
          memo: memo || '',
          teacher_notes: memo || brief || '',
          note: makeNote(brief || memo),
          work_img: fileID,
          work_imgs: fileIDs
        }
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.errMsg && res.result.errMsg.indexOf('ok') >= 0 || res.result === undefined) {
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  }
});
