import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("all extension pages disable DNS prefetch before creating scripts or links", async () => {
  for (const name of ["popup.html", "options.html"]) {
    const source = await readFile(new URL(`../extension/${name}`, import.meta.url), "utf8");
    const match = /<meta http-equiv="x-dns-prefetch-control" content="off">/.exec(source);
    assert.ok(match, name);
    assert.ok(match.index < source.indexOf("<script"), name);
    assert.ok(match.index < source.indexOf("<link"), name);
  }
});
