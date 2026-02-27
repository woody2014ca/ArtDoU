// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    console.log('开始执行清洗...')

    // 1. 【核心】删除 Students 表里所有“名字为空”或“名字是 wu”的脏数据
    // 注意：我们将保留 'hannah' 和 '张小明'，其他名字奇怪的都会被干掉
    const resStudents = await db.collection('Students').where(_.or([
      { name: _.exists(false) }, // 没有名字字段的
      { name: '' },              // 名字是空的
      { name: '' },            // 名字是 wu 的
      { name: '学员' }           // 名字是默认学员的
    ])).remove()

    console.log('删除了脏学生记录数:', resStudents.stats.removed)

    // 2. 【清理关联】获取剩下所有合法的学生 ID
    // 只能查 100 个，如果你的合法学生超过 100 个需要改分页逻辑，但目前看你只有 2 个
    const validRes = await db.collection('Students').get()
    const validIds = validRes.data.map(item => item._id)
    
    console.log('当前合法的学生ID:', validIds)

    if (validIds.length > 0) {
      // 3. 删除 Attendance_logs 中，student_id 不在合法列表里的记录
      const resLogs = await db.collection('Attendance_logs').where({
        student_id: _.nin(validIds) // not in (不在合法ID列表中)
      }).remove()
      console.log('删除了无主的上课记录:', resLogs.stats.removed)
      
      // 4. 删除 Payment_logs 里的脏数据
      const resPay = await db.collection('Payment_logs').where({
        student_id: _.nin(validIds)
      }).remove()
       console.log('删除了无主的缴费记录:', resPay.stats.removed)
    }

    return {
      msg: '清洗完成',
      deletedStudents: resStudents.stats.removed,
      validStudents: validIds
    }

  } catch (e) {
    console.error(e)
    return { error: e }
  }
}