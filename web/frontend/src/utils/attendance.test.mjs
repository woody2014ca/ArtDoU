import {test} from 'node:test';import assert from 'node:assert/strict';import {isLessonCheckin,lessonMovementLabel} from './attendance.js';
test('financial movements distinguish recharge, legacy recharge, rewards and voided checkins',()=>{
 for(const log of [{type:'topup',change_num:5},{type:'topup',lessons_deducted:-5},{type:'reward',change_num:1}])assert.equal(isLessonCheckin(log),false);
 assert.equal(lessonMovementLabel({type:'topup',change_num:5}),'充值增加 5 课时');assert.equal(lessonMovementLabel({type:'topup',lessons_deducted:-5}),'充值增加 5 课时');assert.equal(lessonMovementLabel({type:'reward',change_num:1}),'奖励增加 1 课时');
 assert.equal(isLessonCheckin({change_num:-2}),true);assert.equal(lessonMovementLabel({change_num:-2}),'消耗 2 课时');assert.equal(isLessonCheckin({change_num:-2,voided:true}),false);assert.equal(isLessonCheckin({change_num:-Infinity}),false);
});
