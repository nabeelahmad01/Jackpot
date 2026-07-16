'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

/**
 * Renders modal overlays on document.body so position:fixed works on mobile
 * (avoids clipping inside admin-main-workspace overflow scroll containers).
 */
export default function PanelModalBackdrop({ children, className = 'modal-backdrop-custom', onClick, style, role = 'presentation' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={className} onClick={onClick} style={style} role={role}>
      {children}
    </div>,
    document.body
  );
}
