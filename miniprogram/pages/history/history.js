const app = getApp();
const db = wx.cloud.database();
const RAL_5005 = '#005387'; 

Page({
  data: {
    studentId: '',
    studentName: '',
    timelineEvents: [],
    loading: true,
    isAudit: true,
    canvasHeight: 1000, // 初始高度
  },

  onShow: function () {
     if (typeof app.globalData.isAuditMode !== 'undefined') {
      this.setData({ isAudit: app.globalData.isAuditMode });
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ 
        studentId: options.id,
        studentName: decodeURIComponent(options.name || '学员')
      });
      this.fetchData();
    }
  },

  async fetchData() {
    const id = this.data.studentId;
    try {
      const res = await db.collection('Attendance_logs').where({ student_id: id }).get();
      const works = res.data.map(item => ({
        ...item,
        type: 'work',
        image: item.work_img || item.work_photo,
        displayDate: (item.date || '').split(' ')[0],
        teacher_comment: item.teacher_notes || '今日在画廊的表现非常出色，展现了极佳的艺术天分。'
      }));
      this.setData({
        timelineEvents: works.sort((a, b) => new Date(b.date) - new Date(a.date)),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  // 【核心功能】长图导出
      async doLongReportExport() {
      // --- 强制弹窗测试 ---
      wx.showModal({
        title: '逻辑检查',
        content: '新长图逻辑已启动，如果不弹出预览请检查 Console',
        showCancel: false
      });
    console.log("🔥 艺术长图逻辑已启动，不再跳转页面！");
    const works = this.data.timelineEvents.filter(i => i.image);
    if (works.length === 0) return wx.showToast({ title: '没有作品图片', icon: 'none' });

    wx.showLoading({ title: '正在布置画廊展厅...' });

    try {
      // 1. 预载前 4 张作品（防止图片过多导致内存溢出）
      const assetTasks = works.slice(0, 4).map(item => new Promise(res => {
        wx.getImageInfo({
          src: item.image,
          success: (info) => res({ ...item, local: info.path, w: info.width, h: info.height }),
          fail: () => res(null)
        });
      }));
      const assets = (await Promise.all(assetTasks)).filter(a => a !== null);

      // 2. 动态计算总高度
      let currentY = 400; // 留出页眉空间
      assets.forEach(a => {
        a.drawH = (630 / a.w) * a.h; // 图片等比缩放
        a.startY = currentY;
        // 每项高度 = 图片高度 + 评语空间 + 间距
        currentY += a.drawH + 250; 
      });
      const finalHeight = currentY + 200; // 加上页脚

      // 3. 更新画布高度并等待渲染
      this.setData({ canvasHeight: finalHeight });

      setTimeout(() => {
        this.startDrawing(assets, finalHeight);
      }, 800);

    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '生成海报失败' });
    }
  },

  startDrawing(assets, totalHeight) {
    const query = wx.createSelectorQuery();
    query.select('#artReportCanvas').node().exec(res => {
      if (!res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio;

      canvas.width = 750 * dpr;
      canvas.height = totalHeight * dpr;
      ctx.scale(dpr, dpr);

      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 750, totalHeight);

      // 绘制边框 (RAL 5005)
      ctx.strokeStyle = RAL_5005;
      ctx.lineWidth = 2;
      ctx.strokeRect(25, 25, 700, totalHeight - 50);

      // 绘制报告标题
      ctx.fillStyle = RAL_5005;
      ctx.font = 'bold 50px serif';
      ctx.fillText('ArtDoU', 60, 120);
      ctx.font = '24px sans-serif';
      ctx.fillText('艺术成长长图报告 / GROWTH REPORT', 60, 170);
      ctx.fillText(`学员：${this.data.studentName}`, 60, 230);

      // 循环绘制每一件作品
      assets.forEach((item, index) => {
        // 画作品图
        ctx.drawImage(item.local, 60, item.startY, 630, item.drawH);
        
        // 画日期标签
        ctx.fillStyle = RAL_5005;
        ctx.fillRect(60, item.startY + item.drawH + 20, 150, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = '22px sans-serif';
        ctx.fillText(item.displayDate, 75, item.startY + item.drawH + 48);

        // 核心：垂直排版老师寄语 (RAL 5005)
        ctx.fillStyle = RAL_5005;
        this.drawVerticalText(ctx, item.teacher_comment, 715, item.startY + 20, 24, 8);
      });

      // 导出并预览
      wx.canvasToTempFilePath({
        canvas,
        destWidth: 750 * 2,
        destHeight: totalHeight * 2,
        fileType: 'jpg',
        quality: 0.9,
        success: (f) => {
          wx.hideLoading();
          // 直接打开全屏预览，长按即可保存，不需要再跳转页面
          wx.previewImage({ urls: [f.tempFilePath] });
        }
      });
    });
  },

  // 垂直排版函数
  drawVerticalText(ctx, text, x, y, fontSize, spacing) {
    ctx.font = `${fontSize}px serif`;
    for (let i = 0; i < text.length; i++) {
      if (i > 25) break; // 防止评语过长超出
      ctx.fillText(text[i], x - 30, y + i * (fontSize + spacing));
    }
  }
});