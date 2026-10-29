// @minecraft/server-ui sahtesi.
// ActionFormData: sıradaki yanıt, metni eşleşen düğmeyi seçer (null = kapat).
// CustomForm: sıradaki yanıtlar formu sürer — "metin" düğmeye basar, { set: "etiket", value } bir denetimi değiştirir,
// null formu kapatır. Yanıtlar biterse form oyuncu tarafından kapatılmış sayılır.
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const DataDrivenScreenClosedReason = { ClientClosed: "ClientClosed", ServerClosed: "ServerClosed", UserBusy: "UserBusy" };

export const ui = { answers: [], shown: [], forms: [] };
const plain = (t) => (typeof t === "string" ? t : t?.getData?.() ?? "").replace(/§./g, "");

class Observable {
  constructor(v) { this.v = v; this.subs = []; }
  getData() { return this.v; }
  setData(v) {
    if (v === this.v) return;
    this.v = v;
    for (const s of [...this.subs]) s(v);
  }
  subscribe(f) { this.subs.push(f); return f; }
  unsubscribe(f) { const i = this.subs.indexOf(f); if (i >= 0) this.subs.splice(i, 1); return i >= 0; }
}
export class ObservableNumber extends Observable {}
export class ObservableString extends Observable {}
export class ObservableBoolean extends Observable {}

export class ActionFormData {
  constructor() { this._title = ""; this._body = ""; this._buttons = []; }
  title(t) { this._title = t; return this; }
  body(b) { this._body = b; return this; }
  button(text, icon) { this._buttons.push({ text, icon }); return this; }
  async show() {
    ui.shown.push({ kind: "action", title: this._title, body: this._body, buttons: this._buttons.map((b) => b.text) });
    if (!ui.answers.length) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    const a = ui.answers.shift();
    if (a === null) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    const idx = this._buttons.findIndex((b) => plain(b.text).includes(a));
    if (idx < 0) throw new Error(`Buton bulunamadı: "${a}" (${this._title}): ${this._buttons.map((b) => plain(b.text)).join(" | ")}`);
    return { canceled: false, selection: idx };
  }
}

export class CustomForm {
  constructor(player, title) { this.player = player; this.title = title; this.controls = []; this._res = null; ui.forms.push(this); }
  _add(c) { this.controls.push(c); return this; }
  label(text, options) { return this._add({ kind: "label", text, options }); }
  header(text, options) { return this._add({ kind: "header", text, options }); }
  divider(options) { return this._add({ kind: "divider", options }); }
  spacer(options) { return this._add({ kind: "spacer", options }); }
  image(src, pack, options) { return this._add({ kind: "image", src, pack, options }); }
  dropdown(label, value, items, options) { return this._add({ kind: "dropdown", label, obs: value, items, options }); }
  slider(label, value, min, max, options) { return this._add({ kind: "slider", label, obs: value, min, max, options }); }
  toggle(label, toggled, options) { return this._add({ kind: "toggle", label, obs: toggled, options }); }
  textField(label, text, options) { return this._add({ kind: "text", label, obs: text, options }); }
  button(label, onClick, options) { return this._add({ kind: "button", label, onClick, options }); }
  closeButton() { return this; }
  isShowing() { return !!this._res; }
  close() {
    if (!this._res) return;
    const r = this._res;
    this._res = null;
    r(DataDrivenScreenClosedReason.ServerClosed);
  }
  show() {
    ui.shown.push({ kind: "custom", title: this.title, form: this });
    return new Promise((res) => {
      this._res = res;
      setImmediate(() => this._drive());
    });
  }
  find(kind, text) {
    return this.controls.find((c) => c.kind === kind && plain(c.label).includes(text));
  }
  _drive() {
    while (this._res) {
      if (!ui.answers.length) {
        const r = this._res;
        this._res = null;
        r(DataDrivenScreenClosedReason.ClientClosed);
        return;
      }
      const a = ui.answers.shift();
      if (a === null) {
        const r = this._res;
        this._res = null;
        r(DataDrivenScreenClosedReason.ClientClosed);
        return;
      }
      if (typeof a === "string") {
        const b = this.find("button", a);
        if (!b) throw new Error(`Düğme bulunamadı: "${a}" (${this.title}): ${this.controls.filter((c) => c.kind === "button").map((c) => plain(c.label)).join(" | ")}`);
        b.onClick();
        continue;
      }
      const c = this.controls.find((x) => x.obs && plain(x.label).includes(a.set));
      if (!c) throw new Error(`Denetim bulunamadı: "${a.set}" (${this.title})`);
      c.obs.setData(a.value);
    }
  }
}
