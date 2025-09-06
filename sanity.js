
/*! sanity.js (rewritten)
 * Context-safe API for Poczytalność (SAN) with UI badge, subscriptions, effects,
 * and a typewriter glitch wrapper. No reliance on `this` inside methods.
 * (c) 2025 — MIT License
 */
(function(){
  const API = {};
  const STATE = {
    value: 100,
    min: 0,
    max: 100,
    subscribers: [],
    mountedBadge: null,
    options: { start: 100, mount: null },
    effectTimer: null
  };

  // ---- Utilities
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const notify = () => {
    const val = STATE.value;
    // Classic callback subscribers
    for (const cb of STATE.subscribers.slice()) {
      try { cb(val); } catch(e){ /* swallow */ }
    }
    // DOM CustomEvent for anyone listening
    try {
      const ev = new CustomEvent("sanity:change", { detail: val });
      window.dispatchEvent(ev);
    } catch(_) {}
    // Update mounted UI badge if present
    if (STATE.mountedBadge) {
      const el = STATE.mountedBadge.querySelector("#sanToolbarVal");
      if (el) el.textContent = `${val}/100`;
    }
  };

  function tierFor(v){
    // 1..5 as in page CSS
    return v>=80?1 : v>=60?2 : v>=40?3 : v>=20?4 : 5;
  }

  function ensureBadge(container){
    if (!container) return null;
    // Avoid duplicating badge if a similar one exists
    const existing =
      container.querySelector("#sanToolbarVal") ||
      container.querySelector("[data-san-badge]");
    if (existing && existing.closest(".pill")) {
      STATE.mountedBadge = existing.closest(".pill");
      // make sure value is in sync
      notify();
      return STATE.mountedBadge;
    }
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.setAttribute("data-san-badge","");
    pill.innerHTML = '<strong>SAN</strong>&nbsp;<span id="sanToolbarVal">—</span>';
    container.appendChild(pill);
    STATE.mountedBadge = pill;
    notify();
    return pill;
  }

  // ---- Public API (context-safe: no `this` usage)
  API.init = function init(opts){
    STATE.options = Object.assign({}, STATE.options, opts || {});
    STATE.value = clamp(Number(STATE.options.start ?? 100) || 100, STATE.min, STATE.max);
    // Optional mount point: CSS selector or Element
    const mount = STATE.options.mount;
    if (mount) {
      let container = null;
      if (typeof mount === "string") container = document.querySelector(mount);
      else if (mount && mount.nodeType === 1) container = mount;
      if (container) ensureBadge(container);
    }
    notify();
    return API;
  };

  API.get = function get(){ return STATE.value; };

  API.set = function set(v){
    const nv = clamp(Number(v)||0, STATE.min, STATE.max);
    if (nv === STATE.value) return STATE.value;
    STATE.value = nv;
    notify();
    return STATE.value;
  };

  API.add = function add(delta /*, reason */){
    const nv = clamp(STATE.value + (Number(delta)||0), STATE.min, STATE.max);
    if (nv === STATE.value) return STATE.value;
    STATE.value = nv;
    notify();
    return STATE.value;
  };

  // Alias kept for backward compatibility (change == add)
  API.change = function change(delta){ return API.add(delta); };

  API.subscribe = function subscribe(cb){
    if (typeof cb !== "function") return () => {};
    STATE.subscribers.push(cb);
    // initial push
    try { cb(STATE.value); } catch(_) {}
    return function unsubscribe(){
      const i = STATE.subscribers.indexOf(cb);
      if (i >= 0) STATE.subscribers.splice(i, 1);
    };
  };

  // Safe alias that doesn't rely on `this`
  API.onChange = function onChange(cb){
    return API.subscribe(cb);
  };

  // DOM-style addEventListener compatibility (optional)
  API.addEventListener = function addEventListener(type, handler){
    if (type !== "change") return () => {};
    return API.subscribe(handler);
  };

  // Fire simple visual effects; current consumer calls effect("shake")
  API.effect = function effect(name, ms){
    const dur = Number(ms) || 450;
    // Use a CSS class on <body> to keep it generic
    const cls = name === "shake" ? "san-effect-shake" : `san-effect-${name}`;
    try {
      document.body.classList.add(cls);
      clearTimeout(STATE.effectTimer);
      STATE.effectTimer = setTimeout(() => {
        document.body.classList.remove(cls);
      }, dur);
    } catch(_) {}
  };

  // Provide a wrapper that injects subtle glitches in text output
  // usage: const type = Sanity.wrapTypeText(originalType)(text)
  API.wrapTypeText = function wrapTypeText(typeFn){
    if (typeof typeFn !== "function") return (t)=>Promise.resolve();
    return async function wrapped(text){
      const v = API.get();
      const t = tierFor(v);
      // tiers 1-2: no glitch, 3: rare, 4: some, 5: frequent
      const intensity = (t<=2)?0 : (t===3?0.03 : t===4?0.08 : 0.14);
      const mutate = (ch) => {
        // only mutate letters & some punctuation occasionally
        if (!/[A-Za-zÀ-ž0-9,.…\-!?]/.test(ch)) return ch;
        const roll = Math.random();
        if (roll > intensity) return ch;
        // choose a small distortion
        const kinds = ["dup","swap","dot","tilde","space"];
        const k = kinds[(Math.random()*kinds.length)|0];
        switch(k){
          case "dup": return ch + ch;
          case "swap": return Math.random()<0.5 ? "¬" : "§";
          case "dot": return "·";
          case "tilde": return "~";
          case "space": return ch + "\u200A"; // hair space
          default: return ch;
        }
      };
      // Apply glitch only to the string passed into this call.
      const glitched = String(text).split("").map(mutate).join("");
      // Occasionally add a zero-width joiner to create slight caret hiccups
      const finalOut = Math.random() < intensity*0.5 ? glitched + "\u200D" : glitched;
      return typeFn(finalOut);
    };
  };

  // Expose globally
  window.Sanity = API;
})();
