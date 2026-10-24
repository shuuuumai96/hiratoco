// One shared lock manager for independently imported page modules in Node tests.
export function installLocks() {
  const queues = new Map();
  const locks = {
    request(name, options, callback) {
      const operation = (queues.get(name) ?? Promise.resolve()).then(() => callback({name, mode: options.mode}));
      queues.set(name, operation.catch(() => {}));
      return operation;
    }
  };
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {locks}});
  return locks;
}
