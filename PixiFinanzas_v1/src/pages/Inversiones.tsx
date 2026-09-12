import React from 'react';

export default function Inversiones() {
  return (
    <div className="flex flex-col gap-2.5 p-10 max-w-[680px]" style={{ border: '2px solid var(--color-divider)' }}>
      <span className="text-[11px] tracking-widest uppercase text-neutral-600">Próximamente</span>
      <h3 className="m-0">Módulo Inversiones</h3>
      <p className="note max-w-[56ch]" style={{ fontSize: 14 }}>
        Este módulo está documentado como pendiente en la especificación funcional, sin funcionalidad definida todavía.
        Se habilitará en una fase futura de PixiFinanzas.
      </p>
    </div>
  );
}
