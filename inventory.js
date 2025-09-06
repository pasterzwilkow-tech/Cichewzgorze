/*! inventory.js — Ciche Wzgórze (v1.1)
 *  Globalny ekwipunek współdzielony między modułami.
 *  API: Inventory.add(name), Inventory.remove(name), Inventory.has(name),
 *       Inventory.list(), Inventory.clear(), Inventory.use(name),
 *       Inventory.onChange(cb), Inventory.onUse(cb), Inventory.subscribe(cb)
 *  Stan trzymany w localStorage i synchronizowany między zakładkami.
 */
(() => {
  const LS_KEY = "cw.inventory.v1";

  // --- stan (bezpieczny odczyt z LS)
  let items = new Set();
  try {
    items = new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
  } catch (e) {
    items = new Set();
  }

  function list() { return [...items]; }

  function save(){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list()));
    } catch(e) {}
    dispatch("inventory:change", list());
  }

  function loadFromLS(){
    try {
      items = new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
    } catch(e) {
      items = new Set();
    }
    dispatch("inventory:change", list());
  }

  // --- proste emit/subscribe na window
  const listeners = new Map(); // Map<type, Set<cb>>
  function on(type, cb, {immediateValue} = {}){
    if (typeof cb !== "function") return () => {};
    if(!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(cb);

    // natychmiastowe pierwsze wywołanie (jeśli podano wartość startową)
    if (immediateValue !== undefined) {
      try { cb(immediateValue); } catch(e){}
    }
    return () => { listeners.get(type)?.delete(cb); };
  }

  function dispatch(type, detail){
    const set = listeners.get(type);
    if (set) {
      for (const cb of set) { try { cb(detail); } catch(e){ console.error(e); } }
    }
    // natywny CustomEvent — do window.addEventListener
    try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch(e) {}
  }

  // --- API publiczne
  window.Inventory = {
    add(name){
      if(!name) return;
      items.add(String(name));
      save();
    },
    remove(name){
      items.delete(String(name));
      save();
    },
    has(name){
      return items.has(String(name));
    },
    list,
    clear(){
      items.clear();
      save();
    },
    use(name){ // klik „użyj” (nie zmienia stanu, tylko emituje)
      if(!items.has(String(name))) return;
      dispatch("inventory:use", { item:String(name) });
    },

    // subskrypcje
    onChange(cb){
      // natychmiast oddaj aktualny stan
      return on("inventory:change", cb, { immediateValue: list() });
    },
    onUse(cb){
      return on("inventory:use", cb);
    },

    // 🔧 alias zgodnościowy (jak w sanity.js)
    subscribe(cb){
      return this.onChange(cb);
    }
  };

  // Sync między zakładkami/plikami modułów
  window.addEventListener("storage", (e) => {
    if(e.key === LS_KEY) loadFromLS();
  });

  // start — ogłoś stan (żeby inni dostali pierwszy snapshot)
  dispatch("inventory:change", list());
})();
