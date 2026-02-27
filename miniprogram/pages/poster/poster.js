const app = getApp();
const RAL_5005 = '#005387';

Page({
  data: {
    studentId: '',
    student: {},
    works: [],
    loading: false,
    loadingMessage: '加载作品中...',
    isAudit: false,
    canvasHeight: 600,
    preparedData: [],
    posterImage: '',
    workCandidates: [],
    maxSelect: 4,
    selectedCount: 0,
    isPreview: false,
    selectedKeysForPoster: [] // 本次生成海报实际用的 keys，分享时用，保证张数一致
  },

  onLoad: function (options) {
    const cachedMode = wx.getStorageSync('isAuditMode');
    if (cachedMode === false) this.setData({ isAudit: false });

    const sid = options.id;
    const isPreview = options.mode === 'preview';
    let keysParam = (options.keys && String(options.keys).trim()) || '';
    try { keysParam = decodeURIComponent(keysParam); } catch (e) { }
    if (!sid) {
      this.setData({ loading: false });
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    // 从意向登记返回时页面可能被重建：用缓存恢复海报（仅当未带 keys 时用缓存，带 keys 则用同一套图重新生成）
    const cache = (getApp().globalData || {}).posterCache;
    const useCache = isPreview && !keysParam && cache && cache.studentId === sid && cache.path;
    this.setData({
      studentId: sid,
      isPreview,
      posterImage: useCache ? cache.path : '',
      loading: useCache ? false : true,
      loadingMessage: '加载作品中...'
    });
    this.initPage(sid, isPreview, keysParam);
  },

  onShow: function () {
    // 不再在 onShow 里清空 posterImage，否则从「意向学员登记」返回时海报和「我也要报名」按钮会消失
    // 仅依赖 onLoad 时清空，保证首次进入是选图步骤
  },

  async initPage(sid, isPreview = false, keysParam = '') {
    try {
      this.setData({ loading: true, loadingMessage: '加载作品中...' });

      // ✅ 加速：云端直接按 student_id 过滤日志
      const [studentRes, worksRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'manageData', data: { action: 'get', collection: 'Students', id: sid } }),
        wx.cloud.callFunction({
          name: 'manageData',
          data: { action: 'get', collection: 'Attendance_logs', id: 'all', data: { search_student_id: sid } }
        })
      ]);

      const student = studentRes.result.data || { name: '学员' };
      const allLogs = Array.isArray(worksRes.result.data) ? worksRes.result.data : [];

      // ✅ 兼容：work_imgs(数组) / work_img(单图) / work_photo(旧字段)
      const candidates = allLogs
        .filter(item => {
          const hasImg =
            (item.work_imgs && item.work_imgs.length > 0) ||
            item.work_img ||
            item.work_photo;
          return hasImg;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 18); // 候选多一点，方便选

      this.setData({ student });

      // ✅ 预下载缩略图（并行），用于选择列表展示
      const workCandidates = await this.buildCandidates(candidates);

      if (workCandidates.length === 0) {
        this.setData({ workCandidates: [], selectedCount: 0, loading: false });
        wx.showToast({ title: candidates.length > 0 ? '图片加载失败，请稍后重试' : '该学员暂无带图作品', icon: 'none' });
        return;
      }

      const withDefaultSelect = workCandidates.map((w) => ({ ...w, selected: false }));

      this.setData({
        workCandidates: withDefaultSelect,
        selectedCount: 0,
        loading: false
      });

      // 预览模式：用分享带来的 keys 选图，并按 key 顺序排列，保证与教师端张数、顺序一致
      if (isPreview && !this.data.posterImage) {
        let nextCandidates;
        const rawList = keysParam ? keysParam.split(',').map(k => k.trim()).filter(Boolean) : [];
        const keyList = rawList.slice(0, this.data.maxSelect);
        if (keyList.length > 0) {
          const selectedInOrder = keyList.map(k => withDefaultSelect.find(w => w.key === k)).filter(Boolean);
          const rest = withDefaultSelect.filter(w => !keyList.includes(w.key));
          nextCandidates = [
            ...selectedInOrder.map(w => ({ ...w, selected: true })),
            ...rest.map(w => ({ ...w, selected: false }))
          ];
          if (selectedInOrder.length === 0) {
            nextCandidates = withDefaultSelect.slice(0, this.data.maxSelect).map(x => ({ ...x, selected: true }));
          }
        } else {
          nextCandidates = withDefaultSelect.slice(0, this.data.maxSelect).map(x => ({ ...x, selected: true }));
        }
        const selectedCount = nextCandidates.filter(x => x.selected).length;
        this.setData({
          workCandidates: nextCandidates,
          selectedCount
        }, () => {
          if (selectedCount > 0) this.generatePosterFromSelection();
        });
      }

    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      // 朋友圈/分享卡片预览场景下云调用常失败，提示用户点「前往小程序」即可正常打开
      const msg = isPreview ? '请点击下方「前往小程序」查看' : '加载失败';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    }
  },

  // 每条消课记录的每张图都单独一格，选图时「每次上传的图」都会显示
  async buildCandidates(rawList) {
    const flatItems = [];
    rawList.forEach((work, workIdx) => {
      const links = this.extractLinks(work);
      links.forEach((fileLink, linkIdx) => {
        flatItems.push({ work, fileLink, key: `${work._id || workIdx}-${linkIdx}` });
      });
    });

    const tasks = flatItems.map(async (item) => {
      const thumb = await this.toLocalPath(item.fileLink).catch(() => '');
      return {
        key: item.key,
        raw: item.work,
        fileLink: item.fileLink,
        thumb: thumb || '',
        selected: false
      };
    });

    const res = await Promise.all(tasks);
    return res.filter(x => x.thumb);
  },

  // ✅ 从一条日志提取所有图片链接（数组）
  extractLinks(work) {
    if (work.work_imgs && Array.isArray(work.work_imgs) && work.work_imgs.length > 0) {
      return work.work_imgs;
    }
    const single = work.work_img || work.work_photo;
    return single ? [single] : [];
  },

  // ✅ cloud:// 或 http(s) 转本地路径（用于缩略图/画布）
  async toLocalPath(fileLink) {
    if (!fileLink) throw new Error('empty link');

    let link = fileLink;
    if (!link.startsWith('cloud://')) link = encodeURI(link);

    if (link.startsWith('cloud://')) {
      const res = await wx.cloud.downloadFile({ fileID: link });
      return res.tempFilePath;
    }

    const res = await new Promise((resolve, reject) => {
      wx.downloadFile({
        url: link,
        success: (r) => (r.statusCode === 200 ? resolve(r) : reject(new Error(`status ${r.statusCode}`))),
        fail: reject
      });
    });
    return res.tempFilePath;
  },

  // ✅ 点击选择/取消
  toggleSelect(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = this.data.workCandidates.slice();
    const maxSelect = this.data.maxSelect;

    if (!list[idx]) return;

    const currentSelected = list[idx].selected;
    let selectedCount = this.data.selectedCount;

    // 如果要选中，但已满
    if (!currentSelected && selectedCount >= maxSelect) {
      wx.showToast({ title: `最多选择 ${maxSelect} 张`, icon: 'none' });
      return;
    }

    list[idx].selected = !currentSelected;
    selectedCount += list[idx].selected ? 1 : -1;

    this.setData({ workCandidates: list, selectedCount });
  },

  async generatePosterFromSelection() {
    const selected = this.data.workCandidates.filter(x => x.selected);
    if (selected.length === 0) {
      wx.showToast({ title: '请先选择作品', icon: 'none' });
      return;
    }
    // 记录本次生成实际用的 keys，分享时用这套，避免分享/朋友圈海报比教师端多一张
    const keysUsed = selected.map(x => x.key);
    this.setData({ posterImage: '', preparedData: [], loading: true, loadingMessage: '艺术海报生成中，请稍候', selectedKeysForPoster: keysUsed });
    // 每格对应一张图：selected 里每项有 fileLink + raw(work)，只处理这一张
    await this.processAssets(selected);
  },

  // 选中的每格对应一张图（selected 项含 fileLink + raw）
  async processAssets(selected) {
    let processed = [];
    let totalContentHeight = 0;
    let errorMsg = '';

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      const work = item.raw || item;
      const fileLink = item.fileLink || (this.extractLinks(work)[0]);
      const note = work.brief || work.note || work.teacher_notes || work.memo || '';
      let dateRaw = String(work.date || '');
      let cleanDate = '2026.01.01';
      const d = new Date(dateRaw);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        cleanDate = `${y}.${m}.${day}`;
      } else if (dateRaw.length >= 10) cleanDate = dateRaw.substring(0, 15);

      try {
        if (!fileLink) continue;
        const localPath = await this.toLocalPath(fileLink);
        const info = await wx.getImageInfo({ src: localPath });
        const drawW = 610;
        const scale = drawW / info.width;
        const drawH = info.height * scale;
        processed.push({ path: localPath, drawH, date: cleanDate, note });
        totalContentHeight += (drawH + 240);
      } catch (e) {
        console.error('图片处理失败:', e);
        errorMsg += `图${i + 1}失败; `;
      }
    }

    if (processed.length === 0 && selected.length > 0) {
      wx.showModal({
        title: '生成失败',
        content: '图片无法下载，请稍后重试\n' + errorMsg,
        showCancel: false
      });
      this.setData({ loading: false });
      return;
    }

    // 海报总高：内容区 + 框内底边距 + 框外“新朋友”条带区，确保最后一张评价能显示
    const finalHeight = 400 + totalContentHeight + 220;

    this.setData({
      preparedData: processed,
      canvasHeight: finalHeight
    }, () => {
      // 留足时间让 canvas 按新高度渲染后再绘制（部分机型需更长时间）
      setTimeout(() => {
        this.drawFinalPoster(finalHeight);
      }, 400);
    });
  },

  // 3. 最终绘制
  drawFinalPoster(totalHeight) {
    const safetyTimer = setTimeout(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '生成超时，请重试', icon: 'none' });
    }, 25000);

    const query = wx.createSelectorQuery().in(this);
    query.select('#posterCanvas').node().exec(async (res) => {
      if (!res || !res[0] || !res[0].node) {
        clearTimeout(safetyTimer);
        this.setData({ loading: false });
        wx.showToast({ title: '画布未就绪，请返回重试', icon: 'none' });
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(wx.getWindowInfo().pixelRatio, 1.5);

      canvas.width = 750 * dpr;
      canvas.height = totalHeight * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 750, totalHeight);

      ctx.strokeStyle = RAL_5005;
      ctx.lineWidth = 4;
      // 先不画外框，等内容画完再按内容底边画框，再把「新朋友」条带画在框外
      ctx.fillStyle = RAL_5005;
      ctx.font = 'bold 48px serif';
      ctx.fillText('ArtDoU', 70, 120);

      ctx.font = 'normal 24px sans-serif';
      ctx.fillStyle = '#666';
      const subTitle = this.data.isAudit ? 'DATA ARCHIVE / 数据档案' : 'ART GROWTH REPORT / 艺术成长报告';
      ctx.fillText(subTitle, 70, 160);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 44px sans-serif';
      const nameText = this.data.isAudit ? '固定资产' : (this.data.student.name || '学员');
      ctx.fillText(nameText, 70, 240);

      ctx.fillStyle = RAL_5005;
      ctx.fillRect(70, 260, 60, 8);

      let currentY = 360;

      for (let item of this.data.preparedData) {
        const img = canvas.createImage();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = item.path;
        });

        if (img.width > 0) {
          ctx.drawImage(img, 70, currentY, 610, item.drawH);
        }

        const dateY = currentY + item.drawH + 40;
        ctx.fillStyle = '#999';
        ctx.font = '24px sans-serif';
        ctx.fillText('📅 ' + item.date, 70, dateY);

        const noteText = item.note || '（暂无评语）';

        ctx.fillStyle = '#333';
        ctx.font = 'normal 28px sans-serif';

        const maxWidth = 610;
        const lineHeight = 40;
        let line = '';
        let noteY = dateY + 40;

        for (let n = 0; n < noteText.length; n++) {
          const testLine = line + noteText[n];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, 70, noteY);
            line = noteText[n];
            noteY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 70, noteY);

        currentY = noteY + 80;
      }

      const frameBottom = currentY + 60;
      ctx.strokeStyle = RAL_5005;
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 690, frameBottom - 30);

      if (this.data.isAudit === false) {
        const bannerY = frameBottom + 24;
        ctx.fillStyle = '#FFF0F0';
        ctx.fillRect(30, bannerY, 690, 70);
        ctx.fillStyle = '#E64340';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎁 新朋友立享首次课优享价！', 375, bannerY + 44);
        ctx.textAlign = 'left';
      }

      // 实际导出的高度：尽量贴近内容底部，减少海报底部多余白边
      let exportHeight = frameBottom + 10; // 原来 +40 太大
      if (this.data.isAudit === false) {
        const bannerBottom = frameBottom + 24 + 70;
        exportHeight = bannerBottom + 10;  // 原来 +40 太大
      }
      // 避免超过画布本身高度
      exportHeight = Math.min(exportHeight, totalHeight);

      clearTimeout(safetyTimer);

      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'jpg',
          quality: 0.82,
          destWidth: 750 * dpr,
          destHeight: exportHeight * dpr,
          success: (r) => {
            const path = r.tempFilePath;
            this.setData({ posterImage: path, loading: false });
            const g = getApp().globalData || {};
            if (!g.posterCache) g.posterCache = {};
            g.posterCache.studentId = this.data.studentId;
            g.posterCache.path = path;
          },
          fail: (err) => {
            console.error('生成图片失败', err);
            this.setData({ loading: false });
            wx.showToast({ title: err.errMsg || '生成失败，请重试', icon: 'none', duration: 2500 });
          }
        });
      }, 300);
    });
  },

  goBack: function () {
    wx.navigateBack();
  },

  goToEnroll: function () {
    const sid = this.data.studentId;
    if (!sid) {
      wx.showToast({ title: '未找到推荐人信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/enroll/enroll?referrer=${sid}&from=share`
    });
  },

  saveToPhotos() {
    const path = this.data.posterImage;
    if (!path) return wx.showToast({ title: '请先生成海报', icon: 'none' });
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') >= 0) {
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存到相册，以便分享给朋友',
            confirmText: '去设置',
            success: (res) => { if (res.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    const sid = this.data.studentId;
    // 优先用生成当前海报时保存的 keys，保证分享/朋友圈看到的与教师端张数一致
    const keysUsed = this.data.selectedKeysForPoster || [];
    const keys = (keysUsed.length > 0 ? keysUsed : (this.data.workCandidates || []).filter(x => x.selected).map(x => x.key).slice(0, this.data.maxSelect)).join(',');
    const keysPart = keys ? `&keys=${encodeURIComponent(keys)}` : '';
    return {
      title: 'ArtDoU 艺术成长',
      path: `/pages/poster/poster?id=${sid}&mode=preview&referrer=${sid}${keysPart}`,
      imageUrl: this.data.posterImage || ''
    };
  },

  onShareTimeline() {
    const sid = this.data.studentId;
    const keysUsed = this.data.selectedKeysForPoster || [];
    const keys = (keysUsed.length > 0 ? keysUsed : (this.data.workCandidates || []).filter(x => x.selected).map(x => x.key).slice(0, this.data.maxSelect)).join(',');
    const keysPart = keys ? `&keys=${encodeURIComponent(keys)}` : '';
    const fullName = (this.data.student && this.data.student.name) || '';
    const title = fullName ? `ArtDoU 艺术成长 · ${fullName}` : 'ArtDoU 艺术成长';
    return {
      title,
      query: `id=${sid}&mode=preview&referrer=${sid}${keysPart}`,
      imageUrl: this.data.posterImage || ''
    };
  }
});
