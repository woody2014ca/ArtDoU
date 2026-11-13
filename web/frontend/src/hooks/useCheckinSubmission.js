import { useRef, useState } from 'react';
import { checkinOperation } from '../api';

// Persist identifiers only, never photos, student names or request bodies.
export default function useCheckinSubmission(scope) {
  const storageKey = `artdou-pending-checkin:${scope}`;
  const current = useRef(null);
  const [recovered, setRecovered] = useState(null);
  if (!current.current || current.current.storageKey !== storageKey) {
    const existing = localStorage.getItem(storageKey);
    current.current = { storageKey, id: existing || crypto.randomUUID() };
    localStorage.setItem(storageKey, current.current.id);
  }
  const remember = () => { localStorage.setItem(storageKey, current.current.id); return current.current.id; };
  const finish = () => { localStorage.removeItem(storageKey); current.current.id = crypto.randomUUID(); setRecovered(null); };
  const recover = async () => {
    const result = await checkinOperation(current.current.id);
    if (!result.success) throw new Error(result.msg || '暂时无法确认上次提交，请稍后重试');
    if (result.completed) { setRecovered(result.result); return result.result; }
    return null;
  };
  return { remember, finish, recover, recovered };
}
