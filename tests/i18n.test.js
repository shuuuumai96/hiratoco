import test from "node:test";
import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {AppError, DEFAULT_LANGUAGE, LANGUAGES, MESSAGES, t} from "../extension/i18n.js";
import {DEFAULT_APPS} from "../extension/model.js";

test("manifest translations resolve in both locales and match the UI name", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.default_locale, "en");
  for (const language of LANGUAGES) {
    const messages = JSON.parse(await readFile(new URL(`../extension/_locales/${language}/messages.json`, import.meta.url), "utf8"));
    for (const field of ["name", "description"]) {
      const match = /^__MSG_(\w+)__$/.exec(manifest[field]);
      assert.ok(match, `${field} must be localized`);
      assert.ok(messages[match[1]]?.message, `${language}: ${field}`);
    }
    assert.equal(messages.extensionName.message, t("extensionName", {}, language));
  }
});

test("every message has both languages and matching substitution fields", () => {
  assert.equal(DEFAULT_LANGUAGE, "ja");
  assert.deepEqual(LANGUAGES, ["ja", "en"]);
  for (const [key, translations] of Object.entries(MESSAGES)) {
    assert.equal(translations.length, LANGUAGES.length, key);
    for (const text of translations) assert.ok(typeof text === "string" && text.length > 0, key);
    const fields = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(fields(translations[0]), fields(translations[1]), key);
  }
  for (const app of DEFAULT_APPS) assert.equal(MESSAGES[`app_${app.id}`]?.[0], app.name, app.id);
  assert.equal(t("rowLabel", {name: "<script>$&</script>", position: 2}, "en"), "<script>$&</script>, position 2");
  assert.equal(t("nameInvalid", {max: 50}, "en"), "Enter a name between 1 and 50 characters.");
  assert.match(t("urlHttpsOnly", {}, "en"), /HTTPS/);
  const error = new AppError("nameInvalid", {max: 50});
  assert.equal(error.key, "nameInvalid");
  assert.equal(error.message, t("nameInvalid", {max: 50}, "ja"));
});

test("static UI labels and literal translation calls reference bundled messages", async () => {
  const directory = new URL("../extension/", import.meta.url);
  for (const file of await readdir(directory)) {
    if (!/\.(html|js)$/.test(file)) continue;
    const source = await readFile(new URL(file, directory), "utf8");
    const patterns = [/data-i18n(?:-(?:title|aria-label|alt))?="([\w]+)"/g, /\b(?:t|AppError)\("(\w+)"/g];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) assert.ok(Object.hasOwn(MESSAGES, match[1]), `${file}: ${match[1]}`);
    }
  }
});
