import { EventEmitter } from "node:events";

class NotificationEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000);
  }
  notify(userId: string) {
    this.emit(`notify:${userId}`);
  }
}

const globalForEmitter = globalThis as typeof globalThis & {
  __notificationEmitter?: NotificationEmitter;
};
export const notificationEmitter =
  globalForEmitter.__notificationEmitter ??
  (globalForEmitter.__notificationEmitter = new NotificationEmitter());
