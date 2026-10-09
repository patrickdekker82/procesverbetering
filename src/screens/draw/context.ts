import { createContext, useContext } from 'react';
import type { DiagramEdit, ShapeKind, Side } from '../../core/diagram';

export interface EditorContextValue {
  editingId: string | null;
  /** The single selected item, if exactly one is selected. */
  singleSelected: string | null;
  quickAddKind: ShapeKind;
  errorIds: Set<string>;
  warningIds: Set<string>;
  highlightIds: Set<string>;
  startEdit: (id: string) => void;
  stopEdit: () => void;
  commitText: (id: string, text: string) => void;
  quickAdd: (id: string, direction: Side) => void;
  apply: (edit: DiagramEdit) => void;
  selectLane: (roleId: string) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor outside EditorContext');
  return value;
}
