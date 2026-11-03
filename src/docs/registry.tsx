// Document renderer registry. Adding a kind = one file in ./kinds plus one line here.
import type { ComponentType } from 'react';
import type { DocKind } from '../../shared/types';
import type { DocProps, PaperStyle } from './types';
import Typed from './kinds/typed';
import Carbon from './kinds/carbon';
import Form from './kinds/form';
import Ledger from './kinds/ledger';
import Handwritten from './kinds/handwritten';
import Newspaper from './kinds/newspaper';
import Email from './kinds/email';
import Lab from './kinds/lab';
import SuspectSheet from './kinds/suspect';
import FloorPlan from './kinds/floorplan';
import Photo from './kinds/photo';
import Sealed from './kinds/sealed';
import Handwriting from './kinds/handwriting';
import QR from './kinds/qr';

export interface KindEntry { Component: ComponentType<DocProps>; paper: PaperStyle; icon: string; label: string }

export const registry: Record<DocKind, KindEntry> = {
  typed: { Component: Typed, paper: 'typed', icon: '⌨', label: 'Typed report' },
  carbon: { Component: Carbon, paper: 'carbon', icon: '⧉', label: 'Carbon copy' },
  form: { Component: Form, paper: 'typed', icon: '▤', label: 'Register' },
  ledger: { Component: Ledger, paper: 'ledger', icon: '▥', label: 'Ledger' },
  handwritten: { Component: Handwritten, paper: 'note', icon: '✎', label: 'Handwritten' },
  newspaper: { Component: Newspaper, paper: 'news', icon: '▦', label: 'Clipping' },
  email: { Component: Email, paper: 'screen', icon: '✉', label: 'Email' },
  lab: { Component: Lab, paper: 'lab', icon: '⚗', label: 'Lab report' },
  suspect: { Component: SuspectSheet, paper: 'sheet', icon: '☺', label: 'Suspect sheet' },
  floorplan: { Component: FloorPlan, paper: 'plan', icon: '⌂', label: 'Floor plan' },
  photo: { Component: Photo, paper: 'photo', icon: '▣', label: 'Photograph' },
  sealed: { Component: Sealed, paper: 'envelope', icon: '✉', label: 'Sealed envelope' },
  handwriting: { Component: Handwriting, paper: 'typed', icon: '𝒦', label: 'Handwriting comparison' },
  qr: { Component: QR, paper: 'sticker', icon: '▩', label: 'QR sticker' },
};

export function DocumentView(props: DocProps) {
  const entry = registry[props.doc.kind];
  if (!entry) return <p>Unknown document kind: {props.doc.kind}</p>;
  return <entry.Component {...props} />;
}
