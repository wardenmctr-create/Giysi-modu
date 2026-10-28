// @minecraft/server-ui sahtesi: formlar sıradaki yanıtı etiket eşleşmesiyle seçer.
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };

export const ui = {
  answers: [], // her biri: buton metnini içeren string, ya da null (kapat)
  shown: [],
};

export class ActionFormData {
  constructor() { this._title = ""; this._body = ""; this._buttons = []; }
  title(t) { this._title = t; return this; }
  body(b) { this._body = b; return this; }
  button(text, icon) { this._buttons.push({ text, icon }); return this; }
  async show() {
    ui.shown.push({ title: this._title, body: this._body, buttons: this._buttons.map((b) => b.text) });
    if (!ui.answers.length) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    const a = ui.answers.shift();
    if (a === null) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    const idx = this._buttons.findIndex((b) => b.text.replace(/§./g, "").includes(a));
    if (idx < 0) throw new Error(`Buton bulunamadı: "${a}" (${this._title}): ${this._buttons.map((b) => b.text).join(" | ")}`);
    return { canceled: false, selection: idx };
  }
}
