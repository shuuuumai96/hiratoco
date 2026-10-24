import test from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import {readIconFile} from "../extension/icons.js";
import {imageDimensions, MAX_IMAGE_PIXELS} from "../extension/image-header.js";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(kind, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length); head.write(kind, 4);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind), data])));
  return Buffer.concat([head, data, crc]);
}
function png(width = 1, height = 1, extra = []) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), ...extra, chunk("IDAT", deflateSync(Buffer.alloc(5))), chunk("IEND", Buffer.alloc(0))]);
}
function jpeg(width = 1, height = 1) {
  const frame = Buffer.from([0xff,0xc0,0,11,8,0,0,0,0,1,1,0x11,0]); frame.writeUInt16BE(height, 5); frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff,0xd8]), frame, Buffer.from([0xff,0xda,0,8,1,1,0,0,63,0,0,0xff,0xd9])]);
}
function riffChunk(kind, data) {
  const head = Buffer.alloc(8); head.write(kind); head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, Buffer.alloc(data.length % 2)]);
}
function webp(width = 1, height = 1, canvas) {
  const lossless = Buffer.alloc(5); lossless[0] = 0x2f; lossless.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1);
  const chunks = [];
  if (canvas) { const x = Buffer.alloc(10); x.writeUIntLE(canvas.width - 1, 4, 3); x.writeUIntLE(canvas.height - 1, 7, 3); chunks.push(riffChunk("VP8X", x)); }
  chunks.push(riffChunk("VP8L", lossless));
  const body = Buffer.concat([Buffer.from("WEBP"), ...chunks]);
  const header = Buffer.alloc(8); header.write("RIFF"); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
const keyed = key => error => error.key === key;

test("oversized raster headers reject before any browser decoding", async () => {
  let decodes = 0; globalThis.createImageBitmap = async () => { decodes++; throw new Error("decoder must not run"); };
  for (const [mime, data] of [["image/png", png(4097,4097)], ["image/jpeg", jpeg(65535,65535)], ["image/webp", webp(16384,16384)], ["image/webp", webp(1,1,{width:16384,height:16384})]]) {
    await assert.rejects(readIconFile(new File([data], "oversized", {type: mime})), keyed("imageTooLarge"));
  }
  assert.equal(decodes, 0);
  assert.equal(imageDimensions(png(4096,4096), "image/png").width ** 2, MAX_IMAGE_PIXELS);
});

test("truncation, MIME spoofing, inconsistent WebP dimensions and animation never reach decoder", async () => {
  let decodes = 0; globalThis.createImageBitmap = async () => { decodes++; throw new Error("decoder must not run"); };
  const fixtures = [
    ["image/png", png().subarray(0, 25)], ["image/jpeg", jpeg().subarray(0, 12)], ["image/webp", webp().subarray(0, 19)],
    ["image/png", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')],
    ["image/jpeg", png()], ["image/png", jpeg()], ["image/webp", webp(2,2,{width:1,height:1})],
    ["image/png", png(1,1,[chunk("acTL", Buffer.alloc(8))])]
  ];
  for (const [mime, data] of fixtures) await assert.rejects(readIconFile(new File([data], "invalid", {type:mime})));
  assert.equal(decodes, 0);
});

test("accepted static headers decode once and release the bitmap even on conversion failure", async () => {
  for (const [mime, data] of [["image/png", png()], ["image/jpeg", jpeg()], ["image/webp", webp()]]) {
    let closed = 0; let decoded = 0;
    globalThis.createImageBitmap = async () => { decoded++; return {width:1,height:1,close:()=>closed++}; };
    globalThis.document = {createElement: () => ({getContext: () => ({drawImage(){}}),toDataURL: () => "data:image/png;base64," + png(64,64).toString("base64")})};
    assert.match(await readIconFile(new File([data], "static", {type:mime})), /^data:image\/png;base64,/);
    assert.equal(decoded, 1); assert.equal(closed, 1);
    document.createElement = () => ({getContext: () => null});
    await assert.rejects(readIconFile(new File([data], "static", {type:mime})), keyed("imageConvertFailed"));
    assert.equal(closed, 2);
  }
});

test("a decoder reporting dimensions different from the validated header is rejected and closed", async () => {
  let closed = false;
  globalThis.createImageBitmap = async () => ({width:2,height:1,close:()=>{closed=true;}});
  await assert.rejects(readIconFile(new File([png()], "mismatch", {type:"image/png"})), keyed("imageDecodeFailed"));
  assert.equal(closed,true);
});

test("every truncated container is rejected before decoding, and JPEG rotations preserve the bound", async () => {
  let decodes=0;
  globalThis.createImageBitmap=async()=>{decodes++;return {width:1,height:2,close(){}};};
  for(const [mime,data] of [["image/png",png()],["image/jpeg",jpeg()],["image/webp",webp()]]) {
    for(let end=0;end<data.length;end++) await assert.rejects(readIconFile(new File([data.subarray(0,end)],"truncated",{type:mime})));
  }
  assert.equal(decodes,0);
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=>"data:image/png;base64,"+png(64,64).toString("base64")})};
  await readIconFile(new File([jpeg(2,1)],"rotated",{type:"image/jpeg"}));
  assert.equal(decodes,1);
});
