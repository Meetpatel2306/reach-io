import { describe, it, expect, vi } from 'vitest';
import {
  getNotificationStatus,
  requestNotificationPermission,
  sendNotification,
  playNotificationSound,
} from '@/lib/notifications';

const Notif = (globalThis as any).Notification;

describe('notifications module — permission + send', () => {
  it('NM1: getNotificationStatus returns "default" initially', () => {
    Notif.permission = 'default';
    expect(getNotificationStatus()).toBe('default');
  });

  it('NM2: getNotificationStatus reflects "granted"', () => {
    Notif.permission = 'granted';
    expect(getNotificationStatus()).toBe('granted');
  });

  it('NM3: getNotificationStatus reflects "denied"', () => {
    Notif.permission = 'denied';
    expect(getNotificationStatus()).toBe('denied');
  });

  it('NM4: requestNotificationPermission short-circuits to true if already granted', async () => {
    Notif.permission = 'granted';
    Notif.requestPermission.mockClear();
    expect(await requestNotificationPermission()).toBe(true);
    expect(Notif.requestPermission).not.toHaveBeenCalled();
  });

  it('NM5: requestNotificationPermission short-circuits to false if denied', async () => {
    Notif.permission = 'denied';
    Notif.requestPermission.mockClear();
    expect(await requestNotificationPermission()).toBe(false);
    expect(Notif.requestPermission).not.toHaveBeenCalled();
  });

  it('NM6: requestNotificationPermission asks browser when default', async () => {
    Notif.permission = 'default';
    Notif.requestPermission.mockImplementation(async () => 'granted');
    expect(await requestNotificationPermission()).toBe(true);
    expect(Notif.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('NM7: sendNotification creates a Notification when permission granted', () => {
    Notif.permission = 'granted';
    Notif.instances.length = 0;
    sendNotification('hello', 'world', 'tag-1');
    expect(Notif.instances.length).toBe(1);
    expect(Notif.instances[0].title).toBe('hello');
    expect(Notif.instances[0].options.body).toBe('world');
    expect(Notif.instances[0].options.tag).toBe('tag-1');
  });

  it('NM8: sendNotification is a no-op when permission denied', () => {
    Notif.permission = 'denied';
    Notif.instances.length = 0;
    sendNotification('hi', 'there');
    expect(Notif.instances.length).toBe(0);
  });

  it('NM9: sendNotification falls back to default tag when none given', () => {
    Notif.permission = 'granted';
    Notif.instances.length = 0;
    sendNotification('hi', 'there');
    expect(Notif.instances[0].options.tag).toBe('task-notification');
  });

  it('NM10: playNotificationSound resolves without throwing when enabled', async () => {
    await expect(playNotificationSound('medium', true)).resolves.toBeUndefined();
  });

  it('NM11: playNotificationSound resolves without throwing when disabled', async () => {
    await expect(playNotificationSound('medium', false)).resolves.toBeUndefined();
  });
});
