import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';

function reset() {
  useStore.setState({
    tasks: [],
    pomodoroSessions: [],
    completionHistory: [],
    streak: { current: 0, longest: 0, lastCompletionDate: null },
  });
}

describe('store — task CRUD', () => {
  beforeEach(reset);

  it('ST1: addTask appends a task with generated id and createdAt', () => {
    useStore.getState().addTask({
      title: 'Hi', description: '', priority: 'medium', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const tasks = useStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBeTruthy();
    expect(tasks[0].title).toBe('Hi');
  });

  it('ST2: updateTask merges fields and bumps updatedAt', async () => {
    useStore.getState().addTask({
      title: 'A', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const id = useStore.getState().tasks[0].id;
    const before = useStore.getState().tasks[0].updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    useStore.getState().updateTask(id, { title: 'Renamed' });
    expect(useStore.getState().tasks[0].title).toBe('Renamed');
    expect(useStore.getState().tasks[0].updatedAt).not.toBe(before);
  });

  it('ST3: deleteTask removes by id', () => {
    const s = useStore.getState();
    s.addTask({
      title: 'A', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const id = useStore.getState().tasks[0].id;
    s.deleteTask(id);
    expect(useStore.getState().tasks).toHaveLength(0);
  });

  it('ST4: toggleComplete flips status and sets completedAt', () => {
    useStore.getState().addTask({
      title: 'A', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const id = useStore.getState().tasks[0].id;
    useStore.getState().toggleComplete(id);
    expect(useStore.getState().tasks[0].status).toBe('completed');
    expect(useStore.getState().tasks[0].completedAt).toBeTruthy();
    useStore.getState().toggleComplete(id);
    expect(useStore.getState().tasks[0].status).toBe('pending');
    expect(useStore.getState().tasks[0].completedAt).toBeNull();
  });

  it('ST5: subtasks add/toggle/delete', () => {
    useStore.getState().addTask({
      title: 'A', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const id = useStore.getState().tasks[0].id;
    useStore.getState().addSubtask(id, 'sub1');
    expect(useStore.getState().tasks[0].subtasks).toHaveLength(1);
    const sid = useStore.getState().tasks[0].subtasks[0].id;
    useStore.getState().toggleSubtask(id, sid);
    expect(useStore.getState().tasks[0].subtasks[0].completed).toBe(true);
    useStore.getState().deleteSubtask(id, sid);
    expect(useStore.getState().tasks[0].subtasks).toHaveLength(0);
  });

  it('ST6: settings.notificationsEnabled defaults to true and toggles', () => {
    expect(useStore.getState().settings.notificationsEnabled).toBe(true);
    useStore.getState().updateSettings({ notificationsEnabled: false });
    expect(useStore.getState().settings.notificationsEnabled).toBe(false);
  });

  it('ST7: completing a task triggers streak and history updates', () => {
    useStore.getState().addTask({
      title: 'A', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: [], scheduledAt: null, endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const id = useStore.getState().tasks[0].id;
    useStore.getState().toggleComplete(id);
    expect(useStore.getState().completionHistory.length).toBeGreaterThan(0);
    expect(useStore.getState().streak.current).toBeGreaterThanOrEqual(1);
  });
});
