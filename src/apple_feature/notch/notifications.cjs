'use strict';

class NotchNotifications {
  #queue = [];
  #sequence = 0;
  #timer = null;

  constructor({ setTimer, clearTimer, shouldKeepVisible, onChange }) {
    Object.assign(this, { setTimer, clearTimer, shouldKeepVisible, onChange });
  }

  get current() { return this.#queue[0] || null; }
  get count() { return this.#queue.length; }

  enqueue({ title, body, action = null }) {
    if (!title || !body) return false;
    this.#queue.push({ id: ++this.#sequence, title, body, action });
    if (this.count === 1) this.#showCurrent();
    else this.onChange();
    return true;
  }

  dismiss(id) {
    if (!this.current || this.current.id !== id) return false;
    this.#cancelTimer();
    this.#queue.shift();
    if (this.current) this.#showCurrent();
    else this.onChange();
    return true;
  }

  activate(id) {
    const notification = this.current;
    if (!notification || notification.id !== id) return null;
    this.dismiss(id);
    return notification.action;
  }

  clear() {
    this.#cancelTimer();
    this.#queue = [];
  }

  #cancelTimer() {
    this.clearTimer(this.#timer);
    this.#timer = null;
  }

  #showCurrent() {
    this.#cancelTimer();
    this.onChange(true);
    this.#timer = this.setTimer(() => {
      // Keep the message readable while the pointer is over it or Settings is active.
      if (this.shouldKeepVisible()) this.#showCurrent();
      else this.dismiss(this.current?.id);
    }, 10000);
    this.#timer?.unref?.();
  }
}

module.exports = { NotchNotifications };
