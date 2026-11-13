import React, { useEffect, useRef, useState } from 'react';
import { refreshMediaLink } from '../api';

// Refresh a five-minute image capability once; all other image URLs behave normally.
export default function WorkImage({ src, onError, ...props }) {
  const [current, setCurrent] = useState(src);
  const source = useRef(src);
  const attempted = useRef(false);
  useEffect(() => { source.current = src; attempted.current = false; setCurrent(src); }, [src]);
  const handleError = async event => {
    if (attempted.current) { onError?.(event); return; }
    attempted.current = true;
    try {
      const replacement = await refreshMediaLink(src);
      if (source.current === src && replacement && replacement !== current) { setCurrent(replacement); return; }
    } catch { /* Keep the normal image error behavior after a single refresh attempt. */ }
    onError?.(event);
  };
  return <img {...props} src={current} onError={handleError} />;
}
