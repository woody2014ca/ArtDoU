/**
 * 展厅/海报只展示真实上课作品图，排除续费流水、奖励课时、纯文字备注等。
 */
export function isGalleryArtwork(w) {
  if (!w) return false;
  const hasImg = !!(
    (Array.isArray(w.work_imgs) && w.work_imgs.length) ||
    w.work_img ||
    w.work_photo ||
    w.photo_url
  );
  if (!hasImg) return false;
  if (w.type === 'topup' || w.type === 'reward') return false;
  const note = String(w.note || w.brief || w.teacher_notes || w.memo || '');
  if (/续费核销|财务与课消|待确认缴费|缴费金额|FINANCIAL/.test(note)) return false;
  const cn = Number(w.change_num);
  if (!Number.isNaN(cn) && cn > 0) return false;
  return true;
}

/** 仅老师消课（扣课时）记录 */
export function isLessonCheckin(log) {
  const n = Number(log?.change_num);
  return !Number.isNaN(n) && n < 0;
}
