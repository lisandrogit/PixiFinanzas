import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flash = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }, []);

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {msg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 text-[13px] rounded-lg shadow-lg" style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
