const ABSENT = Symbol("rtdb-absent");
const FORBIDDEN_KEY = /[.#$\/\[\]\u0000-\u001f\u007f]/u;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function define(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function validateKey(key, context) {
  if (typeof key !== "string" || key.length === 0 || FORBIDDEN_KEY.test(key)
    || Buffer.byteLength(key, "utf8") > 768) {
    throw new TypeError(`Invalid RTDB ${context} key`);
  }
}

function parsePath(path, context = "path") {
  if (typeof path !== "string") throw new TypeError("Invalid RTDB path");
  if (path === "") return [];
  if (path.startsWith("/") || path.endsWith("/") || path.includes("//")) {
    throw new TypeError("Invalid RTDB path");
  }
  const keys = path.split("/");
  keys.forEach((key) => validateKey(key, context));
  return keys;
}

function normalizeData(input, ancestors = new WeakSet()) {
  if (input === null) return ABSENT;
  if (typeof input === "string" || typeof input === "boolean") return input;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new TypeError("Invalid RTDB data value");
    return input;
  }
  if (typeof input !== "object" || input === null || ancestors.has(input)) {
    throw new TypeError("Invalid RTDB data value");
  }
  ancestors.add(input);

  let normalized;
  if (Array.isArray(input)) {
    normalized = Array.from(input, (entry) => {
      const child = normalizeData(entry, ancestors);
      return child === ABSENT ? null : child;
    });
    if (normalized.every((entry) => entry === null)) normalized = ABSENT;
  } else {
    if (!isRecord(input) || Object.getOwnPropertySymbols(input).length > 0) {
      throw new TypeError("Invalid RTDB data value");
    }
    normalized = {};
    for (const [key, entry] of Object.entries(input)) {
      validateKey(key, "data");
      const child = normalizeData(entry, ancestors);
      if (child !== ABSENT) define(normalized, key, child);
    }
    if (Object.keys(normalized).length === 0) normalized = ABSENT;
  }

  ancestors.delete(input);
  return normalized;
}

function normalizeRoot(input) {
  if (!isRecord(input)) throw new TypeError("RTDB root must be an object");
  const normalized = normalizeData(input);
  return normalized === ABSENT ? {} : normalized;
}

function read(root, keys) {
  let current = root;
  for (const key of keys) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function write(root, keys, normalized) {
  if (keys.length === 0) {
    for (const key of Object.keys(root)) delete root[key];
    if (normalized !== ABSENT) {
      if (!isRecord(normalized)) throw new TypeError("RTDB root must be an object");
      for (const [key, value] of Object.entries(normalized)) define(root, key, clone(value));
    }
    return;
  }
  let parent = root;
  for (const key of keys.slice(0, -1)) {
    if (!isRecord(parent[key])) define(parent, key, {});
    parent = parent[key];
  }
  const key = keys.at(-1);
  if (normalized === ABSENT) delete parent[key];
  else define(parent, key, clone(normalized));
}

function isPrefix(left, right) {
  return left.length < right.length && left.every((key, index) => key === right[index]);
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
    this.state = normalizeRoot(initial);
    this.transactionCalls = [];
    this.updateCalls = [];
    this.transactionFaults = new Map();
    this.updateFaults = [];
  }

  retryTransaction(path, mutateBeforeRetry) {
    const pathKeys = parsePath(path);
    const canonicalPath = pathKeys.join("/");
    const faults = this.transactionFaults.get(canonicalPath) ?? [];
    faults.push({ type: "retry", mutateBeforeRetry });
    this.transactionFaults.set(canonicalPath, faults);
  }

  abortTransaction(path) {
    const pathKeys = parsePath(path);
    const canonicalPath = pathKeys.join("/");
    const faults = this.transactionFaults.get(canonicalPath) ?? [];
    faults.push({ type: "abort" });
    this.transactionFaults.set(canonicalPath, faults);
  }

  failNextUpdate(beforeReject) {
    this.updateFaults.push(beforeReject);
  }

  ref(path = "") {
    const pathKeys = parsePath(path);
    const canonicalPath = pathKeys.join("/");
    const database = this;
    return {
      async get() {
        return new FakeSnapshot(read(database.state, pathKeys));
      },

      async update(updates) {
        if (!isRecord(updates)) throw new TypeError("Invalid RTDB update data");
        const prepared = Object.entries(updates).map(([relativePath, value]) => {
          const relativeKeys = parsePath(relativePath, "update path");
          if (relativeKeys.length === 0) throw new TypeError("Invalid RTDB update path");
          return {
            keys: [...pathKeys, ...relativeKeys],
            normalized: normalizeData(value),
          };
        });
        for (let left = 0; left < prepared.length; left += 1) {
          for (let right = left + 1; right < prepared.length; right += 1) {
            if (isPrefix(prepared[left].keys, prepared[right].keys)
              || isPrefix(prepared[right].keys, prepared[left].keys)) {
              throw new TypeError("Invalid overlapping RTDB update paths");
            }
          }
        }

        const beforeReject = database.updateFaults.shift();
        if (beforeReject) {
          database.updateCalls.push(clone(updates));
          beforeReject(database.state);
          database.state = normalizeRoot(database.state);
          throw new Error("injected update failure");
        }

        const draft = clone(database.state);
        for (const { keys, normalized } of prepared) write(draft, keys, normalized);
        database.state = normalizeRoot(draft);
        database.updateCalls.push(clone(updates));
      },

      async transaction(updater) {
        const attempts = [];
        const apply = () => {
          const current = clone(read(database.state, pathKeys)) ?? null;
          const proposal = updater(current);
          if (proposal !== undefined) normalizeData(proposal);
          attempts.push({ current, proposal: clone(proposal) });
          return proposal;
        };

        let proposal = apply();
        const fault = (database.transactionFaults.get(canonicalPath) ?? []).shift();
        if (fault?.type === "retry") {
          fault.mutateBeforeRetry(database.state);
          database.state = normalizeRoot(database.state);
          proposal = apply();
        }
        database.transactionCalls.push({ path: canonicalPath, attempts });
        if (fault?.type === "abort" || proposal === undefined) {
          return { committed: false, snapshot: new FakeSnapshot(read(database.state, pathKeys)) };
        }

        const draft = clone(database.state);
        write(draft, pathKeys, normalizeData(proposal));
        database.state = normalizeRoot(draft);
        return { committed: true, snapshot: new FakeSnapshot(read(database.state, pathKeys)) };
      },
    };
  }
}
