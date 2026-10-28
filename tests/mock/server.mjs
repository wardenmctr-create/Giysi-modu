// @minecraft/server için test sahtesi. Container.getItem kopya döndürür (gerçek API gibi);
// böylece scriptlerin değişiklikleri setItem ile geri yazdığı da doğrulanır.

const handlers = (names) => Object.fromEntries(names.map((n) => [n, { list: [], subscribe(f) { this.list.push(f); return f; }, fire(e) { for (const f of this.list) f(e); } }]));

class DynProps {
  constructor() { this.props = new Map(); }
  getDynamicProperty(k) { return this.props.get(k); }
  setDynamicProperty(k, v) { if (v === undefined) this.props.delete(k); else this.props.set(k, v); }
}

export class Container {
  constructor(size) { this.size = size; this.slots = new Array(size).fill(undefined); }
  getItem(i) { return this.slots[i]?.clone(); }
  setItem(i, it) { this.slots[i] = it ? it.clone() : undefined; }
  addItem(it) {
    let left = it.clone();
    for (let i = 0; i < this.size && left; i++) {
      const s = this.slots[i];
      if (s && s.isStackableWith(left)) {
        const room = s.maxAmount - s.amount;
        const n = Math.min(room, left.amount);
        s.amount += n; left.amount -= n;
        if (!left.amount) left = undefined;
      }
    }
    for (let i = 0; i < this.size && left; i++) if (!this.slots[i]) { this.slots[i] = left; left = undefined; }
    return left;
  }
  clearAll() { this.slots.fill(undefined); }
  get emptySlotsCount() { return this.slots.filter((s) => !s).length; }
}

export class ItemStack extends DynProps {
  constructor(typeId, amount = 1) {
    super();
    this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
    this.nameTag = undefined;
    this.keepOnDeath = false;
    this.lore = [];
    this._inv = this.typeId.startsWith("gm:bag_") ? new Container(4) : undefined;
  }
  get maxAmount() { return this.typeId.startsWith("gm:") ? 1 : 64; }
  getComponent(id) { return id === "minecraft:inventory" && this._inv ? { container: this._inv } : undefined; }
  setLore(l) { this.lore = l ?? []; }
  getLore() { return [...this.lore]; }
  isStackableWith(o) { return o.typeId === this.typeId && this.maxAmount > 1 && this.props.size === 0 && o.props.size === 0; }
  clone() {
    const c = new ItemStack(this.typeId, this.amount);
    c.props = new Map(this.props);
    c.nameTag = this.nameTag; c.keepOnDeath = this.keepOnDeath; c.lore = [...this.lore];
    if (this._inv) { c._inv = new Container(4); c._inv.slots = this._inv.slots.map((s) => s?.clone()); }
    return c;
  }
}

export const EquipmentSlot = { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet", Mainhand: "Mainhand", Offhand: "Offhand" };
export const Direction = { Up: "Up", Down: "Down", North: "North", South: "South", East: "East", West: "West" };

let entityCounter = 0;
export class Dimension {
  constructor() { this.items = []; this.entities = []; }
  spawnItem(it, loc) { const e = { item: it.clone(), location: loc }; this.items.push(e); return e; }
  spawnEntity(typeId, loc) { const e = new Entity(typeId, this, loc); this.entities.push(e); return e; }
}

export class Entity extends DynProps {
  constructor(typeId, dimension, location = { x: 0, y: 64, z: 0 }) {
    super();
    this.typeId = typeId; this.dimension = dimension; this.location = location;
    this.id = `e${++entityCounter}`; this.isValid = true; this.properties = new Map();
    this.inv = typeId === "gm:placed_bag" ? new Container(4) : undefined;
  }
  getComponent(id) { return id === "minecraft:inventory" && this.inv ? { container: this.inv } : undefined; }
  setProperty(k, v) { this.properties.set(k, v); }
  getProperty(k) { return this.properties.get(k); }
  setRotation() {}
  getRotation() { return { x: 0, y: 0 }; }
  remove() { this.isValid = false; this.dimension.entities = this.dimension.entities.filter((e) => e !== this); }
}

export class Player extends Entity {
  constructor(name, dimension) {
    super("minecraft:player", dimension);
    this.name = name;
    this.container = new Container(36);
    this.equipment = {};
    this.messages = []; this.actionbar = []; this.animations = [];
    this.selectedSlotIndex = 0;
    this.onScreenDisplay = { setActionBar: (m) => this.actionbar.push(m) };
  }
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: this.container };
    if (id === "minecraft:equippable") return { getEquipment: (s) => this.equipment[s] };
    return undefined;
  }
  sendMessage(m) { this.messages.push(m); }
  playAnimation(name, opts) { this.animations.push({ name, ...opts }); }
}

const timers = [];
export const system = {
  currentTick: 0,
  beforeEvents: handlers(["startup"]),
  afterEvents: handlers(["scriptEventReceive"]),
  run(f) { timers.push({ at: this.currentTick + 1, f }); return timers.length; },
  runTimeout(f, d = 1) { timers.push({ at: this.currentTick + d, f }); return timers.length; },
  runInterval(f, d = 1) { timers.push({ at: this.currentTick + d, f, every: d }); return timers.length; },
  async tick(n = 1) {
    for (let k = 0; k < n; k++) {
      this.currentTick++;
      for (const t of [...timers]) {
        if (t.at <= this.currentTick && !t.done) {
          t.f();
          if (t.every) t.at += t.every; else t.done = true;
        }
      }
      await new Promise((r) => setImmediate(r));
    }
  },
};

const worldProps = new DynProps();
export const world = {
  players: [],
  getAllPlayers() { return this.players.filter((p) => p.isValid); },
  getDynamicProperty: (k) => worldProps.getDynamicProperty(k),
  setDynamicProperty: (k, v) => worldProps.setDynamicProperty(k, v),
  afterEvents: handlers(["worldLoad", "playerSpawn", "playerLeave", "entityHitEntity", "entityContainerOpened", "entityContainerClosed"]),
  beforeEvents: handlers(["entityItemPickup"]),
};
