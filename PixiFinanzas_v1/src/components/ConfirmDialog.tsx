import React from 'react';

export default function ConfirmDialog({
  title, body, okLabel = 'Confirmar', onConfirm, onCancel,
}: { title: string; body: string; okLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <h4 className="m-0 mb-2">{title}</h4>
        <p className="m-0 mb-5 text-sm text-neutral-800">{body}</p>
        <div className="flex gap-2.5">
          <button className="btn btn-primary" onClick={onConfirm}>{okLabel}</button>
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
