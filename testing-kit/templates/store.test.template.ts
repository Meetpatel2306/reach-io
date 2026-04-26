// Zustand-style store test template. Adapt to Redux/Jotai/Valtio with minor tweaks.
// Pattern: reset state in beforeEach, then assert on getState() and selectors.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replace with your real store import:
// import { useStore } from '@/stores/your-store';

// Demo store so this file runs as-is. Delete and replace.
import { create } from 'zustand';

type Todo = { id: string; title: string; done: boolean };
type State = {
  todos: Todo[];
  add: (title: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  countOpen: () => number;
};
const useStore = create<State>((set, get) => ({
  todos: [],
  add: (title) => set((s) => ({ todos: [...s.todos, { id: crypto.randomUUID(), title, done: false }] })),
  toggle: (id) => set((s) => ({ todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t) })),
  remove: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
  clear: () => set({ todos: [] }),
  countOpen: () => get().todos.filter((t) => !t.done).length,
}));

describe('store — basic mutations', () => {
  beforeEach(() => useStore.getState().clear());

  it('adds an item', () => {
    useStore.getState().add('first');
    expect(useStore.getState().todos).toHaveLength(1);
    expect(useStore.getState().todos[0].title).toBe('first');
    expect(useStore.getState().todos[0].done).toBe(false);
  });

  it('toggles an item', () => {
    useStore.getState().add('a');
    const id = useStore.getState().todos[0].id;
    useStore.getState().toggle(id);
    expect(useStore.getState().todos[0].done).toBe(true);
    useStore.getState().toggle(id);
    expect(useStore.getState().todos[0].done).toBe(false);
  });

  it('removes an item', () => {
    useStore.getState().add('keep');
    useStore.getState().add('drop');
    const dropId = useStore.getState().todos[1].id;
    useStore.getState().remove(dropId);
    expect(useStore.getState().todos.map((t) => t.title)).toEqual(['keep']);
  });
});

describe('store — selectors / derived state', () => {
  beforeEach(() => useStore.getState().clear());

  it('countOpen reflects undone items only', () => {
    useStore.getState().add('a');
    useStore.getState().add('b');
    useStore.getState().add('c');
    const ids = useStore.getState().todos.map((t) => t.id);
    useStore.getState().toggle(ids[0]);
    expect(useStore.getState().countOpen()).toBe(2);
  });
});

describe('store — subscriptions', () => {
  beforeEach(() => useStore.getState().clear());

  it('notifies subscribers when state changes', () => {
    const listener = vi.fn();
    const unsub = useStore.subscribe(listener);
    useStore.getState().add('x');
    expect(listener).toHaveBeenCalled();
    unsub();
    listener.mockClear();
    useStore.getState().add('y');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('store — invariants', () => {
  beforeEach(() => useStore.getState().clear());

  it('ids are unique across many adds', () => {
    for (let i = 0; i < 100; i++) useStore.getState().add(`t-${i}`);
    const ids = new Set(useStore.getState().todos.map((t) => t.id));
    expect(ids.size).toBe(100);
  });

  it('toggle is idempotent in pairs', () => {
    useStore.getState().add('a');
    const id = useStore.getState().todos[0].id;
    const before = { ...useStore.getState().todos[0] };
    useStore.getState().toggle(id);
    useStore.getState().toggle(id);
    expect(useStore.getState().todos[0]).toEqual(before);
  });
});
