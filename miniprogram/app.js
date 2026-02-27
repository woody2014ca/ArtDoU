// app.js
App({
  onLaunch: function () {
    // 1. 定义全局变量初始状态
    this.globalData = {
      // 默认开启审核模式 (true)，确保即使网络断开也显示的是“账本”
      isAuditMode: true, 
      env: 'art-7g0kbgp830d170e8'
    };

    // 2. 初始化云开发
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    // 3. 从云数据库获取实时配置 (审核开关)
    this.fetchSystemConfig();
  },

  /**
   * 从云数据库拉取系统配置
   */
  fetchSystemConfig: function() {
    const db = wx.cloud.database();
    // 建议在数据库新建一个名为 'configs' 的集合，并添加一条 _id 为 'system_config' 的记录
    db.collection('configs').doc('system_config').get({
      success: (res) => {
        if (res.data && typeof res.data.isAuditMode !== 'undefined') {
          this.globalData.isAuditMode = res.data.isAuditMode;
          console.log("【系统配置】审核模式已更新为:", this.globalData.isAuditMode);
        }
      },
      fail: (err) => {
        // 如果获取失败（比如还没建表），保持默认开启审核模式，保障提审安全
        console.warn("【系统配置】无法获取远程配置，当前处于安全审核模式", err);
        this.globalData.isAuditMode = true;
      }
    });
  },

  // 全局数据对象
  globalData: {
    isAuditMode: true,
    env: 'art-7g0kbgp830d170e8'
  }
});
