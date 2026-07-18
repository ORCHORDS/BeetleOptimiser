// useGlobalSearch - listens for Ctrl/Cmd+K globally and returns whether
// the search palette should be open. The actual search UI lives in
// src/components/shared/CommandPalette.jsx (a modal mounted once at the
// top of App.jsx).

import { useEffect, useState } from 'react';

export default function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e) {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // Escape closes
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return [open, setOpen];
}
