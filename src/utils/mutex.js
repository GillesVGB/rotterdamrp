export class Mutex {
  constructor() { this.tasks = new Map(); }
  async run(key, fn) {
    const previous = this.tasks.get(key) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    this.tasks.set(key, current); await previous;
    try { return await fn(); }
    finally { release(); if (this.tasks.get(key) === current) this.tasks.delete(key); }
  }
}
