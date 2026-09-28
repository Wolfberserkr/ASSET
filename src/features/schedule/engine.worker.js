// Background build for the Team Schedule Builder. Same protocol as the reference page's blob worker:
// posts {p} while building, then {done} with the result or {err} with a message.
import E from './engine.js';

self.onmessage = (e) => {
  const o = e.data;
  o.async = true;
  o.onProgress = (p) => self.postMessage({ p });
  E.buildMonth(o).then(
    (r) => self.postMessage({ done: r }),
    (err) => self.postMessage({ err: String((err && err.message) || err) }),
  );
};
