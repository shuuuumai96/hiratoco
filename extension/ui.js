import {DEFAULT_APPS, DEFAULT_ICON} from "./model.js";
import {t} from "./i18n.js";

const defaultNames = new Map(DEFAULT_APPS.map(app => [app.id, app.name]));

/**
 * Translate only untouched defaults; preserve user-provided names.
 */
export function appDisplayName(app) {
  return app.name === defaultNames.get(app.id) ? t(`app_${app.id}`) : app.name;
}

export function applyTheme(state) {
  document.documentElement.dataset.theme = state.settings.theme;
}

export function appImage(app) {
  const image = document.createElement("img");
  image.src = app.icon;
  image.alt = "";
  image.width = 44;
  image.height = 44;
  image.draggable = false;
  image.addEventListener("error", () => { image.src = DEFAULT_ICON; }, {once: true});
  return image;
}

export function button(label, action, className = "") {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.className = className;
  element.addEventListener("click", action);
  return element;
}
