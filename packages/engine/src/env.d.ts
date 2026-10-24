// structuredClone exists in every runtime we target (Node ≥ 17, modern browsers, Web Workers) but is
// only typed by the DOM / Node libs, which the engine deliberately does not include.
declare function structuredClone<T>(value: T): T;
