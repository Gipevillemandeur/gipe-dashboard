'use client';

import { Eye } from 'lucide-react';

/*
 * Petit badge « Lecture seule » affiché en haut des rubriques
 * que la personne peut seulement consulter.
 */
export default function ReadOnlyBadge() {
  return (
    <span
      title="Tu peux consulter cette rubrique, mais pas la modifier."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: '#f3efe9',
        border: '1px solid #e2d8cc',
        color: '#6b5d57',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Eye size={14} />
      Lecture seule
    </span>
  );
}
