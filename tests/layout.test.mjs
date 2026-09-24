import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../src/layout.js", import.meta.url), "utf8");
const sandbox = {};
vm.runInNewContext(code, sandbox);
const { pictureRect, nextMode } = sandbox.UbbLayout;

const wide = pictureRect(2560, 1080, 1920, 1080);
assert.equal(wide.sideBars, true);
assert.ok(Math.abs(wide.scale - 2560 / 1920) < 0.001);
assert.ok(wide.x > 0);

const match = pictureRect(1920, 1080, 1920, 1080);
assert.equal(match.sideBars, false);
assert.equal(match.scale, 1);

const tall = pictureRect(1920, 1080, 1920, 800);
assert.equal(tall.sideBars, false);

assert.equal(nextMode("original"), "ambient");
assert.equal(nextMode("ambient"), "crop");
assert.equal(nextMode("crop"), "original");
assert.equal(pictureRect(0, 10, 10, 10), null);

const { ambientSampleDriver, shouldRunAmbientLoop } = sandbox.UbbLayout;
assert.equal(ambientSampleDriver(true), "video-frame");
assert.equal(ambientSampleDriver(false), "animation-frame");
assert.equal(
  shouldRunAmbientLoop({ mode: "ambient", playing: true, sideBars: true }),
  true
);
assert.equal(
  shouldRunAmbientLoop({ mode: "ambient", playing: false, sideBars: true }),
  false
);
assert.equal(
  shouldRunAmbientLoop({ mode: "original", playing: true, sideBars: true }),
  false
);
assert.equal(
  shouldRunAmbientLoop({ enabled: false, mode: "ambient", playing: true, sideBars: true }),
  true
);
assert.equal(
  shouldRunAmbientLoop({ mode: "crop", playing: true, sideBars: true }),
  false
);
assert.equal(
  shouldRunAmbientLoop({ mode: "ambient", playing: true, sideBars: false, letterbox: true }),
  true
);

function frame(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const color = paint(x, y);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }
  return data;
}

const { detectBlackBars, fillCropRect, fillScaleForBox } = sandbox.UbbLayout;
const sidePixels = frame(100, 40, (x) => (x < 12 || x >= 88 ? [0, 0, 0] : [200, 40, 40]));
const sideBars = detectBlackBars(sidePixels, 100, 40);
assert.equal(sideBars.sideBars, true);
assert.equal(sideBars.letterbox, false);
assert.ok(sideBars.left >= 12 && sideBars.right >= 12);

const letterPixels = frame(80, 40, (x, y) => (y < 8 || y >= 32 ? [0, 0, 0] : [40, 160, 200]));
const letterBars = detectBlackBars(letterPixels, 80, 40);
assert.equal(letterBars.letterbox, true);
assert.equal(letterBars.sideBars, false);
assert.ok(letterBars.top >= 8 && letterBars.bottom >= 8);
assert.equal(detectBlackBars(null, 10, 10), null);

const sideCrop = fillCropRect(1920, 1080, { left: 240, right: 240, top: 0, bottom: 0, sideBars: true, letterbox: false });
const letterCrop = fillCropRect(1920, 1080, { left: 0, right: 0, top: 140, bottom: 140, sideBars: false, letterbox: true });
assert.equal(sideCrop.axis, "x");
assert.equal(sideCrop.y, 0);
assert.equal(sideCrop.height, 1080);
assert.ok(sideCrop.width < 1920);
assert.equal(letterCrop.axis, "y");
assert.equal(letterCrop.x, 0);
assert.equal(letterCrop.width, 1920);
assert.ok(letterCrop.height < 1080);
assert.notEqual(sideCrop.axis, letterCrop.axis);

const sideFill = fillScaleForBox(1920, 1080, 1920, 1080, sideBars && {
  left: (sideBars.left * 1920) / 100,
  right: (sideBars.right * 1920) / 100,
  top: 0,
  bottom: 0,
  sideBars: true,
  letterbox: false,
});
const letterFill = fillScaleForBox(1920, 1080, 1920, 1080, {
  left: 0,
  right: 0,
  top: 140,
  bottom: 140,
  sideBars: false,
  letterbox: true,
});
assert.equal(sideFill.axis, "x");
assert.equal(letterFill.axis, "y");
assert.ok(sideFill.scale > 1);
assert.ok(letterFill.scale > 1);

console.log("layout tests passed");
