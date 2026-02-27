const cloud = require('wx-server-sdk')
cloud.init({ env:'art-7g0kbgp830d170e8'})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const ctx = cloud.getWXContext()
  const OPENID_RAW = (ctx.OPENID || ctx.openid || '').toString().trim()
  const { collection, action, id, data } = event

  try {
    let isAuditModeFromDB = true
    try {
      const configRes = await db.collection('configs').doc('system_config').get()
      isAuditModeFromDB = configRes.data.isAuditMode !== false 
    } catch (e) {
      console.log('读取配置失败，默认开启审核模式')
    }

    let userRole = 'guest'
    let myStudentId = null
    const openidMatch = (a, b) => String(a || '').trim() === String(b || '').trim()

    const teacherRes = await db.collection('Teachers').where({ _openid: OPENID_RAW }).get()
    if (teacherRes.data.length > 0) {
      userRole = 'admin'
    } else {
      let bindingRes = await db.collection('Parent_bindings').where({ _openid: OPENID_RAW }).get()
      if (bindingRes.data.length === 0) {
        bindingRes = await db.collection('Parent_bindings').where({ parent_openid: OPENID_RAW }).get()
      }
      if (bindingRes.data.length === 0) {
        const allBindings = await db.collection('Parent_bindings').limit(100).get()
        const found = (allBindings.data || []).find(
          b => openidMatch(b._openid, OPENID_RAW) || openidMatch(b.parent_openid, OPENID_RAW)
        )
        if (found) bindingRes = { data: [found] }
      }
      if (bindingRes.data.length > 0) {
        const binding = bindingRes.data[0]
        myStudentId = binding.student_id
        if (openidMatch(binding.parent_openid, OPENID_RAW) || openidMatch(binding._openid, OPENID_RAW)) {
          userRole = 'parent'
        } else {
          try {
            const studentDoc = await db.collection('Students').doc(myStudentId).get()
            if (studentDoc.data && studentDoc.data.parent_activated === true) userRole = 'parent'
          } catch (e) {}
        }
        if (userRole !== 'parent') myStudentId = null
      }
    }
const start = Date.now()
const rid = `${start}-${Math.random().toString(16).slice(2,8)}`
console.log('[RID]', rid, 'IN', { action, collection, id, dataKeys: data ? Object.keys(data) : null })
    // 3. 动作路由
    switch (action) {
      case 'init': 
        return { 
          success: true, 
          role: userRole, 
          myStudentId: myStudentId,
          isAuditOpen: isAuditModeFromDB, 
          debug_openid: OPENID_RAW 
        }

      case 'get': {
  // ==============================================================
  // ✅ GET：查询数据（列表 / 单条）
  // 目标：
  // 1) 保留原有权限与过滤逻辑（审核模式、管理员/家长）
  // 2) 修复“switch 穿透”风险：确保 get 绝不可能落入 add
  // 3) 支持两种查询：
  //    - Situation A: id === 'all'  -> 查列表（最多 100 条）
  //    - Situation B: id !== 'all'  -> 查单条（doc(id)）
  // ==============================================================

  // ✅ 正确的日志标签：这里是 get，不是 add
  console.log('[RID]', rid, 'HIT case:get', {
    role: userRole,
    collection,
    id,
    dataKeys: data ? Object.keys(data) : null
  })

  // 脱敏逻辑 - 【保留原逻辑】
  // 审核模式开启时，陌生人(guest)禁止读取任何数据 —— 除非是「家长分享链接」查看该学员信息与作品
  if (userRole === 'guest' && isAuditModeFromDB) {
    const shareStudentId = (id && id !== 'all') ? id : (event.search_student_id || (data && data.search_student_id))
    const allowShareStudents = collection === 'Students' && id && id !== 'all'
    const allowShareLogs = collection === 'Attendance_logs' && id === 'all' && shareStudentId
    if (allowShareStudents) {
      const one = await db.collection(collection).doc(id).get()
      return { success: true, data: one.data }
    }
    if (allowShareLogs) {
      const result = await db.collection(collection).where({ student_id: shareStudentId }).limit(100).get()
      return { success: true, data: result.data }
    }
    return { success: false, msg: 'Audit Mode' }
  }

  // ✅ Situation A: 查列表 (id === 'all')
  if (id === 'all') {
    let filter = {}
    // 查 Attendance_logs 且带了 search_student_id 时，只返回该学员记录（教师端生成海报用）
    if (collection === 'Attendance_logs' && data && data.search_student_id) {
      filter = { student_id: data.search_student_id }
    } else if (userRole === 'admin') {
      filter = {}
    } else {
      // 非管理员只能看“自己的数据” - 【保留原逻辑】

      // 非管理员：按 student_id 或 myStudentId 过滤
      if (collection === 'Attendance_logs' && data && data.search_student_id) {
        filter = { student_id: data.search_student_id }
      } else {
        // 否则，只能看自己的：
        // - 查 Students：只能查自己那条 student 记录
        // - 查其它集合：按 student_id 绑定到自己的 student
        filter = (collection === 'Students'
          ? { _id: myStudentId }
          : { student_id: myStudentId }
        )
      }
    }

    // 限制 100 条防止卡顿 - 【保留原逻辑】
    const result = await db.collection(collection).where(filter).limit(100).get()
    return { success: true, data: result.data }
  }

  // ✅ Situation B: 查单个 (id 是具体的 docId) ——【修复点：补齐单条查询并 return】
  const one = await db.collection(collection).doc(id).get()
  return { success: true, data: one.data }

  // 注意：这里不需要 break。
  // 因为上面已经 return，且用 block 包裹，未来扩展也不容易误穿透。
}


      case 'add':
  // ==============================================================
  // ✅ ADD：新增数据
  // 原逻辑：
  // - admin 可以新增任何 collection
  // - parent 仅允许新增 Leave_requests（请假条）
  // 说明：此处不改变权限逻辑，避免功能回退
  // ==============================================================

  console.log('[RID]', rid, 'HIT case:add', { role: userRole, collection, hasData: !!data })

  // ✅ 仅报警：如果 data 为空/未传，记录出来（不拦截，不回退功能）
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    console.warn('[RID]', rid, '⚠️ ADD with empty data', { action, collection, id, data })
  }

  const isParentRequesting = (userRole === 'parent' && collection === 'Leave_requests')
  const isPaymentLogByGuest = (collection === 'Payment_logs') // 准家长提交缴费凭证，无需先绑定

  if (userRole !== 'admin' && !isParentRequesting && !isPaymentLogByGuest) {
    return { success: false, msg: 'Permission Denied' }
  }

  return await db.collection(collection).add({
    data: { ...data, _openid: OPENID_RAW, createTime: db.serverDate() }
  })

case 'increment':
  // ==============================================================
  // ✅ INCREMENT：课时增减（仅 admin）
  // ==============================================================
  console.log('[RID]', rid, 'HIT case:increment', { role: userRole, collection, id, value: data && data.value })

  if (userRole !== 'admin') return { success: false, msg: 'Permission Denied' }
  return await db.collection(collection).doc(id).update({
    data: { left_classes: _.inc(data.value) }
  })

case 'update':
  // ==============================================================
  // ✅ UPDATE：更新（仅 admin）
  // ==============================================================
  console.log('[RID]', rid, 'HIT case:update', { role: userRole, collection, id, dataKeys: data ? Object.keys(data) : null })

  if (userRole !== 'admin') return { success: false, msg: 'Permission Denied' }
  return await db.collection(collection).doc(id).update({ data })

case 'delete':
  // ==============================================================
  // ✅ DELETE：删除（仅 admin）
  // ==============================================================
  console.log('[RID]', rid, 'HIT case:delete', { role: userRole, collection, id })

  if (userRole !== 'admin') return { success: false, msg: 'Permission Denied' }
  return await db.collection(collection).doc(id).remove()

case 'bindParent':
  // ==============================================================
  // 家长绑定：凭手机号绑定为“已缴费学员”的家长（仅手机号匹配且已缴费）
  // 任何人可调用（guest 未绑定前）
  // ==============================================================
  {
    const phoneRaw = (event.phone || '').trim()
    if (!phoneRaw) return { success: false, msg: '请输入手机号' }
    const phoneNorm = phoneRaw.replace(/\D/g, '')
    if (phoneNorm.length < 8) return { success: false, msg: '手机号格式有误' }

    const studentsWithActivated = await db.collection('Students').where({ parent_activated: true }).limit(100).get()
    const found = (studentsWithActivated.data || []).find(s => (String(s.parent_phone || '').replace(/\D/g, '') === phoneNorm))
    if (!found) return { success: false, msg: '未找到已缴费的家长，请核对手机号或联系老师' }

    const studentId = found._id
    const updatePayload = { _openid: OPENID_RAW, parent_openid: OPENID_RAW, parent_phone: phoneRaw, student_id: studentId, updateTime: db.serverDate() }
    // 1) 先按当前微信 openid 查是否已有绑定
    let existing = await db.collection('Parent_bindings').where({ _openid: OPENID_RAW }).get()
    if (existing.data.length === 0) existing = await db.collection('Parent_bindings').where({ parent_openid: OPENID_RAW }).get()
    // 2) 若没有，再按「该学员+该手机号」查：修复旧数据（库里已有记录但缺 _openid/parent_openid）
    if (existing.data.length === 0) {
      const byPhone = await db.collection('Parent_bindings').where({ student_id: studentId }).limit(20).get()
      const samePhone = (byPhone.data || []).find(b => String(b.parent_phone || '').replace(/\D/g, '') === phoneNorm)
      if (samePhone) existing = { data: [samePhone] }
    }
    if (existing.data.length > 0) {
      await db.collection('Parent_bindings').doc(existing.data[0]._id).update({
        data: updatePayload
      })
    } else {
      await db.collection('Parent_bindings').add({
        data: { _openid: OPENID_RAW, parent_openid: OPENID_RAW, parent_phone: phoneRaw, student_id: studentId, createTime: db.serverDate() }
      })
    }
    return { success: true, role: 'parent', myStudentId: studentId }
  }

case 'findStudentForPayment':
  // ==============================================================
  // 渠道1-意向学员缴费：先查意向名单，再查正式学员。返回 prospectiveId 或 studentId
  // ==============================================================
  {
    const phoneRaw = (event.phone || '').trim()
    const studentNameRaw = (event.studentName || '').trim()
    if (!phoneRaw) return { success: false, msg: '请输入家长手机号' }
    const phoneNorm = phoneRaw.replace(/\D/g, '')
    if (phoneNorm.length < 8) return { success: false, msg: '手机号格式有误' }

    // 先查意向名单（pending）
    const prospectives = await db.collection('Prospective_students').where({ status: 'pending' }).limit(200).get()
    const listP = (prospectives.data || []).filter(p =>
      String(p.phone || '').replace(/\D/g, '') === phoneNorm
    )
    if (studentNameRaw) {
      const nameNorm = studentNameRaw.replace(/\s/g, '')
      const matchP = listP.find(p => (String(p.name || '').replace(/\s/g, '') === nameNorm || (p.name || '').includes(studentNameRaw)))
      if (matchP) return { success: true, isProspective: true, prospectiveId: matchP._id, studentName: matchP.name || studentNameRaw }
    }
    if (listP.length === 1) return { success: true, isProspective: true, prospectiveId: listP[0]._id, studentName: listP[0].name || '学员' }
    if (listP.length > 1) return { success: false, msg: '该手机号对应多名意向学员，请同时输入学员姓名' }

    // 再查正式学员（渠道2：教师已录入但未绑定的，用分享链接；此处支持已录入学员的姓名+手机查找）
    const allStudents = await db.collection('Students').limit(200).get()
    const list = (allStudents.data || []).filter(s =>
      String(s.parent_phone || '').replace(/\D/g, '') === phoneNorm
    )
    if (studentNameRaw) {
      const nameNorm = studentNameRaw.replace(/\s/g, '')
      const matched = list.find(s => (String(s.name || '').replace(/\s/g, '') === nameNorm || (s.name || '').includes(studentNameRaw)))
      if (matched) return { success: true, studentId: matched._id, studentName: matched.name || studentNameRaw }
      return { success: false, msg: '未找到该学员，请核对姓名与手机号或联系老师' }
    }
    if (list.length === 0) return { success: false, msg: '未找到该手机号对应的学员或意向，请联系老师' }
    if (list.length > 1) return { success: false, msg: '该手机号对应多名学员，请同时输入学员姓名' }
    return { success: true, studentId: list[0]._id, studentName: list[0].name || '学员' }
  }

case 'confirmProspectivePayment':
  // ==============================================================
  // 待确认缴费：对「意向学员」的缴费做「确认入账并转为正式学员」
  // 仅 admin
  // ==============================================================
  {
    if (userRole !== 'admin') return { success: false, msg: 'Permission Denied' }
    const paymentId = event.paymentId
    const prospectiveId = event.prospectiveId
    if (!paymentId || !prospectiveId) return { success: false, msg: '参数缺失' }

    const payDoc = await db.collection('Payment_logs').doc(paymentId).get()
    if (!payDoc.data) return { success: false, msg: '缴费记录不存在' }
    const pay = payDoc.data
    const prosDoc = await db.collection('Prospective_students').doc(prospectiveId).get()
    if (!prosDoc.data) return { success: false, msg: '意向记录不存在' }
    const pros = prosDoc.data
    const initialLessons = Number(pay.amount_lessons) || 0
    const studentName = pay.student_name || pros.name || '学员'

    const addRes = await db.collection('Students').add({
      data: {
        name: pros.name,
        age: pros.age,
        parent_phone: pros.phone,
        left_classes: initialLessons,
        enroll_date: new Date().toLocaleDateString(),
        remark: '缴费转正',
        parent_activated: true,
        createTime: db.serverDate()
      }
    })
    const newStudentId = addRes._id

    await db.collection('Payment_logs').doc(paymentId).update({
      data: { student_id: newStudentId, status: 'confirmed', confirm_time: new Date().toLocaleString() }
    })
    await db.collection('Prospective_students').doc(prospectiveId).update({
      data: { status: 'converted' }
    })
    await db.collection('Attendance_logs').add({
      data: {
        student_id: newStudentId,
        student_name: studentName,
        date: new Date().toLocaleDateString(),
        type: 'topup',
        note: `续费核销（意向转正）：￥${pay.price || 0} / +${initialLessons}课时`,
        lessons_deducted: -initialLessons,
        createTime: db.serverDate()
      }
    })

    return { success: true, newStudentId }
  }

case 'getMyOpenid':
  return { success: true, openid: OPENID_RAW }

case 'setParentByOpenid':
  if (userRole !== 'admin') return { success: false, msg: 'Permission Denied' }
  const targetOpenid = (event.openid || '').trim()
  const targetStudentId = event.studentId
  if (!targetOpenid || !targetStudentId) return { success: false, msg: '缺少 openid 或学员 ID' }
  const stuDoc = await db.collection('Students').doc(targetStudentId).get()
  if (!stuDoc.data) return { success: false, msg: '学员不存在' }
  const existing = await db.collection('Parent_bindings').where({ parent_openid: targetOpenid }).get()
  if (existing.data.length > 0) {
    await db.collection('Parent_bindings').doc(existing.data[0]._id).update({
      data: { student_id: targetStudentId, updateTime: db.serverDate() }
    })
  } else {
    await db.collection('Parent_bindings').add({
      data: { student_id: targetStudentId, parent_openid: targetOpenid, createTime: db.serverDate() }
    })
  }
  await db.collection('Students').doc(targetStudentId).update({
    data: { parent_activated: true }
  })
  return { success: true, msg: '已将该微信设为该学员家长' }

      default: 
        return { success: false, msg: 'Unknown Action' }
    }
  } catch (e) { 
    return { success: false, error: e.toString() } 
  }
}
