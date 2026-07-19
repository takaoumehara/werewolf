function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function parts(path) {
  return String(path ?? "").split("/").filter(Boolean);
}

function read(root, path) {
  let current = root;
  for (const part of parts(path)) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function write(root, path, value) {
  const keys = parts(path);
  if (keys.length === 0) {
    for (const key of Object.keys(root)) delete root[key];
    if (value && typeof value === "object") Object.assign(root, clone(value));
    return;
  }
  let parent = root;
  for (const key of keys.slice(0, -1)) {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    parent = parent[key];
  }
  const key = keys.at(-1);
  if (value === null || value === undefined) delete parent[key];
  else parent[key] = clone(value);
}

class FakeSnapshot {
  constructor(value) {
    this.value = clone(value);
  }

  exists() {
    return this.value !== undefined && this.value !== null;
  }

  val() {
    return clone(this.value) ?? null;
  }
}

export class FakeRtdb {
  constructor(initial = {}) {
    this.state = clone(initial);
    this.transactionCalls = [];
    this.updateCalls = [];
    this.transactionFaults = new Map();
    this.updateFaults = [];
  }

  retryTransaction(path, mutateBeforeRetry) {
    const faults = this.transactionFaults.get(path) ?? [];
    faults.push({ type: "retry", mutateBeforeRetry });
    this.transactionFaults.set(path, faults);
  }

  abortTransaction(path) {
    const faults = this.transactionFaults.get(path) ?? [];
    faults.push({ type: "abort" });
    this.transactionFaults.set(path, faults);
  }

  failNextUpdate(beforeReject) {
    this.updateFaults.push(beforeReject);
  }

  ref(path = "") {
    const database = this;
    return {
      async get() {
        return new FakeSnapshot(read(database.state, path));
      },

      async update(updates) {
        database.updateCalls.push(clone(updates));
        const beforeReject = database.updateFaults.shift();
        if (beforeReject) {
          beforeReject(database.state);
          throw new Error("injected update failure");
        }
        for (const [relativePath, value] of Object.entries(updates)) {
          const fullPath = [path, relativePath].filter(Boolean).join("/");
          write(database.state, fullPath, value);
        }
      },

      async transaction(updater) {
        const attempts = [];
        const apply = () => {
          const current = clone(read(database.state, path)) ?? null;
          const proposal = updater(current);
          attempts.push({ current, proposal: clone(proposal) });
          return proposal;
        };

        let proposal = apply();
        const fault = (database.transactionFaults.get(path) ?? []).shift();
        if (fault?.type === "retry") {
          fault.mutateBeforeRetry(database.state);
          proposal = apply();
        }
        database.transactionCalls.push({ path, attempts });
        if (fault?.type === "abort" || proposal === undefined) {
          return { committed: false, snapshot: new FakeSnapshot(read(database.state, path)) };
        }
        write(database.state, path, proposal);
        return { committed: true, snapshot: new FakeSnapshot(read(database.state, path)) };
      },
    };
  }
}
