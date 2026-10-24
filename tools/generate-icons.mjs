import {mkdir, writeFile} from "node:fs/promises";

const directory = new URL("../extension/icons/", import.meta.url);
await mkdir(directory, {recursive: true});
/**
 * Original symbolic artwork; no Google logos or third-party assets are used.
 */
const shapes = {
  account: '<circle cx="32" cy="24" r="9"/><path d="M15 51c0-17 34-17 34 0"/>',
  search: '<circle cx="28" cy="28" r="13"/><path d="m38 38 13 13"/>',
  maps: '<path d="M47 26c0 12-15 28-15 28S17 38 17 26a15 15 0 0 1 30 0Z"/><circle cx="32" cy="26" r="5"/>',
  youtube: '<rect x="11" y="18" width="42" height="29" rx="9"/><path d="m28 25 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  play: '<path d="m21 13 29 19-29 19Z"/><path d="m21 13 18 26M21 51l18-26" opacity=".45"/>',
  gmail: '<rect x="10" y="16" width="44" height="33" rx="5"/><path d="m11 19 21 16 21-16"/>',
  drive: '<path d="m27 12 13 0 18 32-7 11H14L7 44Z"/><path d="m27 12 18 32H7m33-32L20 47m-6 8 13-23"/>',
  calendar: '<rect x="12" y="16" width="40" height="38" rx="5"/><path d="M12 27h40M23 11v11m18-11v11M23 37h4m10 0h4M23 45h4m10 0h4"/>',
  translate: '<path d="M9 18h28M23 12v6m9 1c-1 14-10 20-20 23m5-17c3 7 9 12 17 15m1 11 9-24 10 24m-16-7h13"/>',
  gemini: '<path d="M32 8c2 16 8 22 24 24-16 2-22 8-24 24-2-16-8-22-24-24C24 30 30 24 32 8Z"/>',
  news: '<rect x="10" y="14" width="44" height="38" rx="5"/><rect x="17" y="22" width="12" height="13" rx="1"/><path d="M36 23h10m-10 9h10M18 43h28"/>',
  photos: '<rect x="10" y="13" width="44" height="39" rx="5"/><circle cx="23" cy="25" r="4"/><path d="m11 46 12-11 9 6 9-14 12 19"/>',
  keep: '<path d="M22 39a17 17 0 1 1 20 0l-2 6H24Z"/><path d="M25 51h14M32 43V30m-6-3 6 5 6-5"/>',
  meet: '<rect x="9" y="18" width="31" height="29" rx="5"/><path d="m40 27 15-9v29l-15-9Z"/>',
  site: '<circle cx="32" cy="32" r="22"/><ellipse cx="32" cy="32" rx="10" ry="22"/><path d="M10 32h44M15 20h34M15 44h34"/>'
};
const palette = {
  account: ["#e8f0fe", "#1967d2"], search: ["#e8f0fe", "#1967d2"], maps: ["#e6f4ea", "#137333"],
  youtube: ["#fce8e6", "#c5221f"], play: ["#e0f2f1", "#00796b"], gmail: ["#fce8e6", "#c5221f"],
  drive: ["#e6f4ea", "#137333"], calendar: ["#e8f0fe", "#1967d2"], translate: ["#e8f0fe", "#1967d2"],
  gemini: ["#f0e7fd", "#7627bb"], news: ["#e8f0fe", "#1967d2"], photos: ["#fff3cf", "#926100"],
  keep: ["#fff3cf", "#926100"], meet: ["#e6f4ea", "#137333"], site: ["#eef0f4", "#566174"]
};
for (const [id, shape] of Object.entries(shapes)) {
  const [background, foreground] = palette[id];
  await writeFile(new URL(`${id}.svg`, directory), `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${background}"/><g fill="none" stroke="${foreground}" color="${foreground}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>\n`);
}
const dots = Array.from({length: 9}, (_, i) => `<circle cx="${16 + i % 3 * 16}" cy="${16 + Math.floor(i / 3) * 16}" r="5"/>`).join("");
for (const [name, color] of [["launcher", "#4285f4"], ["toolbar-dark", "#424854"], ["toolbar-light", "#f1f3f8"]]) {
  await writeFile(new URL(`${name}.svg`, directory), `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="${color}">${dots}</g></svg>\n`);
}
