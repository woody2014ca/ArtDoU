import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * 未登录用户（家长）打开教师分享的页面时，先跳转绑定手机号，绑定成功后回到原链接（由 BindParent 处理 redirect）。
 * 老师 / 已绑定家长不拦截。
 */
export function useGuestRedirectToBind(enabled = true) {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;
    if (loading) return;
    if (role !== 'guest') return;
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/bind?redirect=${next}`, { replace: true });
  }, [enabled, loading, role, navigate, location.pathname, location.search]);

  if (!enabled) {
    return { block: false };
  }
  if (loading || role === null) {
    return { block: true, reason: 'loading' };
  }
  if (role === 'guest') {
    return { block: true, reason: 'redirect' };
  }
  return { block: false };
}
