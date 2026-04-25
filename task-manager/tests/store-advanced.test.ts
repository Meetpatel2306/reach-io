import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, APP_NAME, APP_VERSION } from '@/lib/constants';

function reset() {
  useStore.setState({
    tasks: [],
    categories: DEFAULT_CATEGORIES,
    pomodoroSessions: [],
    completionHistory: [],
    settings: { ...DEFAULT_SETTINGS },
    streak: { current: 0, longest: 0, lastCompletionDate: null },
  });
}

function makeBaseTask(over: any = {}) {
  return {
    title: 'X', description: '', priority: 'medium' as const, status: 'pending' as const,
    categoryId: null, tags: [], scheduledAt: null, endAt: null,
    notifyOnEnd: false, recurrence: 'once' as const, completedAt: null,
    pomodorosEstimated: 1, subtasks: [], ...over,
  };
}

describe('store — categories', () => {
  beforeEach(reset);

  it('SA1: addCategory appends with generated id', () => {
    const before = useStore.getState().categories.length;
    useStore.getState().addCategory({ name: 'Custom', color: '#abc', icon: 'Star' });
    const after = useStore.getState().categories;
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1].name).toBe('Custom');
    expect(after[after.length - 1].id).toBeTruthy();
  });

  it('SA2: updateCategory partial-updates by id', () => {
    useStore.getState().addCategory({ name: 'A', color: '#111', icon: 'X' });
    const id = useStore.getState().categories.at(-1)!.id;
    useStore.getState().updateCategory(id, { name: 'A2' });
    expect(useStore.getState().categories.find((c) => c.id === id)?.name).toBe('A2');
  });

  it('SA3: deleteCategory removes and unsets categoryId on tasks', () => {
    useStore.getState().addCategory({ name: 'Bin', color: '#000', icon: 'X' });
    const id = useStore.getState().categories.at(-1)!.id;
    useStore.getState().addTask(makeBaseTask({ categoryId: id }));
    expect(useStore.getState().tasks[0].categoryId).toBe(id);
    useStore.getState().deleteCategory(id);
    expect(useStore.getState().categories.find((c) => c.id === id)).toBeUndefined();
    expect(useStore.getState().tasks[0].categoryId).toBeNull();
  });
});

describe('store — pomodoro', () => {
  beforeEach(reset);

  it('SA4: addPomodoroSession appends', () => {
    useStore.getState().addPomodoroSession({
      taskId: null, startedAt: new Date().toISOString(), duration: 1500, type: 'work',
    });
    expect(useStore.getState().pomodoroSessions).toHaveLength(1);
  });

  it('SA5: work-type session bumps task pomodorosCompleted', () => {
    useStore.getState().addTask(makeBaseTask());
    const taskId = useStore.getState().tasks[0].id;
    expect(useStore.getState().tasks[0].pomodorosCompleted).toBe(0);
    useStore.getState().addPomodoroSession({
      taskId, startedAt: new Date().toISOString(), duration: 1500, type: 'work',
    });
    expect(useStore.getState().tasks[0].pomodorosCompleted).toBe(1);
  });

  it('SA6: break-type session does NOT bump pomodorosCompleted', () => {
    useStore.getState().addTask(makeBaseTask());
    const taskId = useStore.getState().tasks[0].id;
    useStore.getState().addPomodoroSession({
      taskId, startedAt: new Date().toISOString(), duration: 300, type: 'break',
    });
    expect(useStore.getState().tasks[0].pomodorosCompleted).toBe(0);
  });

  it('SA7: session with no taskId does not crash', () => {
    expect(() => {
      useStore.getState().addPomodoroSession({
        taskId: null, startedAt: new Date().toISOString(), duration: 1500, type: 'work',
      });
    }).not.toThrow();
  });
});

describe('store — import/export', () => {
  beforeEach(reset);

  it('SA8: exportData round-trips through importData with same task count', () => {
    useStore.getState().addTask(makeBaseTask({ title: 'A' }));
    useStore.getState().addTask(makeBaseTask({ title: 'B' }));
    const json = useStore.getState().exportData();
    useStore.getState().clearAllData();
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(useStore.getState().importData(json)).toBe(true);
    expect(useStore.getState().tasks).toHaveLength(2);
  });

  it('SA9: importData rejects malformed JSON', () => {
    expect(useStore.getState().importData('{bad json')).toBe(false);
  });

  it('SA10: importData rejects payload without tasks array', () => {
    expect(useStore.getState().importData('{"foo": 1}')).toBe(false);
  });

  it('SA11: exportData includes the app version + name', () => {
    const json = JSON.parse(useStore.getState().exportData());
    expect(json.version).toBe(APP_VERSION);
    expect(json.appName).toBe(APP_NAME);
    expect(json.exportedAt).toBeTruthy();
  });

  it('SA12: importData with missing optional sections fills defaults', () => {
    const minimal = JSON.stringify({ tasks: [] });
    expect(useStore.getState().importData(minimal)).toBe(true);
    expect(useStore.getState().categories.length).toBe(DEFAULT_CATEGORIES.length);
    expect(useStore.getState().pomodoroSessions).toHaveLength(0);
  });

  it('SA13: clearAllData resets every collection', () => {
    useStore.getState().addTask(makeBaseTask());
    useStore.getState().clearAllData();
    expect(useStore.getState().tasks).toHaveLength(0);
    expect(useStore.getState().pomodoroSessions).toHaveLength(0);
    expect(useStore.getState().completionHistory).toHaveLength(0);
  });
});

describe('store — reorderTasks', () => {
  beforeEach(reset);

  it('SA14: reorderTasks rewrites order indices', () => {
    useStore.getState().addTask(makeBaseTask({ title: 'A' }));
    useStore.getState().addTask(makeBaseTask({ title: 'B' }));
    useStore.getState().addTask(makeBaseTask({ title: 'C' }));
    const t = useStore.getState().tasks;
    useStore.getState().reorderTasks([t[2], t[0], t[1]]);
    const reordered = useStore.getState().tasks;
    expect(reordered.map((x) => x.title)).toEqual(['C', 'A', 'B']);
    expect(reordered.map((x) => x.order)).toEqual([0, 1, 2]);
  });
});

describe('store — recordCompletion + streak', () => {
  beforeEach(reset);

  it('SA15: recordCompletion increments today\'s entry', () => {
    useStore.getState().recordCompletion();
    useStore.getState().recordCompletion();
    const today = useStore.getState().completionHistory[0];
    expect(today.completed).toBe(2);
  });

  it('SA16: updateStreak — first completion sets streak.current to 1', () => {
    useStore.getState().updateStreak();
    expect(useStore.getState().streak.current).toBe(1);
    expect(useStore.getState().streak.longest).toBe(1);
  });

  it('SA17: updateStreak called twice in same day is a no-op', () => {
    useStore.getState().updateStreak();
    const longestAfterFirst = useStore.getState().streak.longest;
    useStore.getState().updateStreak();
    expect(useStore.getState().streak.longest).toBe(longestAfterFirst);
  });
});

describe('store — settings persistence shape', () => {
  beforeEach(reset);

  it('SA18: updateSettings is partial — other fields preserved', () => {
    useStore.getState().updateSettings({ pomodoroWork: 50 });
    expect(useStore.getState().settings.pomodoroWork).toBe(50);
    expect(useStore.getState().settings.pomodoroBreak).toBe(DEFAULT_SETTINGS.pomodoroBreak);
  });

  it('SA19: defaultPriority and defaultRecurrence start at sane values', () => {
    expect(['low', 'medium', 'high', 'urgent']).toContain(useStore.getState().settings.defaultPriority);
    expect(['once', 'daily', 'weekly', 'monthly']).toContain(useStore.getState().settings.defaultRecurrence);
  });
});
