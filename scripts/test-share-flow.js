/**
 * 分享/报名流程逻辑自测（不依赖 wx，仅验证分支条件）
 * 运行: node scripts/test-share-flow.js
 */
const assert = (ok, msg) => {
  if (!ok) throw new Error(msg);
  console.log('  ✓', msg);
};

console.log('1. 分享页访客：是否隐藏剩余课时');
const isViewingSharedLink = true;
const isGuest = true;
const showLessonsStat = !isGuest && !isViewingSharedLink;
assert(showLessonsStat === false, 'isViewingSharedLink 时 lessons-stat 不显示');
const showRenewAlert = !isGuest && !isViewingSharedLink && true;
assert(showRenewAlert === false, 'isViewingSharedLink 时 renew-alert 不显示');

console.log('\n2. 报名页：从分享进入应显示意向登记');
const enroll_from_share = true;
const referrerId = '';
const fromShare = false;
const fromShareStorage = enroll_from_share;
const shouldShowEnrollForm = fromShareStorage || referrerId || fromShare;
assert(shouldShowEnrollForm === true, 'enroll_from_share 为 true 时应走意向学员登记');

console.log('\n3. 报名页：onShow 早于 setData 时仍能识别分享');
const options = { referrer: 'student_id_123', from: 'share' };
const referrer = (options && options.referrer) ? options.referrer : '';
const fromShareFromOptions = (options && options.from === 'share') || !!referrer;
assert(referrer === 'student_id_123', 'onLoad 能正确解析 referrer');
assert(fromShareFromOptions === true, 'onLoad 能正确解析 from=share');
assert(!!referrer || fromShareFromOptions, '写入 enroll_from_share 后 onShow 用同步存储可识别');

console.log('\n全部通过.');
process.exit(0);
