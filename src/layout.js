(function (root) {
  var MODES = ["original", "ambient", "crop", "stretch"];

  function pictureRect(boxW, boxH, videoW, videoH) {
    if (!(boxW > 0) || !(boxH > 0) || !(videoW > 0) || !(videoH > 0)) return null;
    var boxRatio = boxW / boxH;
    var videoRatio = videoW / videoH;
    if (boxRatio > videoRatio * 1.02) {
      var width = boxH * videoRatio;
      var scale = boxRatio / videoRatio;
      return {
        x: (boxW - width) / 2,
        y: 0,
        width: width,
        height: boxH,
        sideBars: true,
        letterBars: false,
        scale: scale,
        coverScale: scale,
        stretchX: boxW / width,
        stretchY: 1,
        boxW: boxW,
        boxH: boxH,
      };
    }
    if (videoRatio > boxRatio * 1.02) {
      var height = boxW / videoRatio;
      var cover = boxH / height;
      return {
        x: 0,
        y: (boxH - height) / 2,
        width: boxW,
        height: height,
        sideBars: false,
        letterBars: true,
        scale: 1,
        coverScale: cover,
        stretchX: 1,
        stretchY: cover,
        boxW: boxW,
        boxH: boxH,
      };
    }
    return {
      x: 0,
      y: 0,
      width: boxW,
      height: boxH,
      sideBars: false,
      letterBars: false,
      scale: 1,
      coverScale: 1,
      stretchX: 1,
      stretchY: 1,
      boxW: boxW,
      boxH: boxH,
    };
  }

  function visibleModes(hidden) {
    var hide = {};
    if (hidden && hidden.length) {
      for (var i = 0; i < hidden.length; i++) hide[hidden[i]] = true;
    }
    var list = [];
    for (var j = 0; j < MODES.length; j++) {
      if (!hide[MODES[j]]) list.push(MODES[j]);
    }
    if (!list.length) return [MODES[0]];
    return list;
  }

  function nextMode(mode, hidden) {
    var list = visibleModes(hidden);
    var index = list.indexOf(mode);
    if (index < 0) return list[0];
    return list[(index + 1) % list.length];
  }

  function ambientSampleDriver(hasVideoFrameCallback) {
    return hasVideoFrameCallback ? "video-frame" : "animation-frame";
  }

  function shouldRunAmbientLoop(state) {
    state = state || {};
    return state.mode === "ambient" && !!state.playing && !!state.sideBars;
  }

  function rowWidth(row) {
    if (!row || !row.length) return 0;
    if (typeof row[0] === "number") return Math.floor(row.length / 3);
    return row.length;
  }

  function pixelAt(row, x) {
    if (typeof row[0] === "number") {
      return [row[x * 3] || 0, row[x * 3 + 1] || 0, row[x * 3 + 2] || 0];
    }
    var p = row[x] || [0, 0, 0];
    return [p[0] || 0, p[1] || 0, p[2] || 0];
  }

  function luma(px) {
    return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
  }

  function detectBlackBars(rows, options) {
    options = options || {};
    var threshold = options.threshold == null ? 22 : options.threshold;
    var darkRatio = options.darkRatio == null ? 0.8 : options.darkRatio;
    var minFraction = options.minFraction == null ? 0.04 : options.minFraction;
    var empty = {
      left: false,
      right: false,
      top: false,
      bottom: false,
      leftCols: 0,
      rightCols: 0,
      topRows: 0,
      bottomRows: 0,
      width: 0,
      height: 0,
    };
    if (!rows || !rows.length) return empty;
    var height = rows.length;
    var width = rowWidth(rows[0]);
    if (!(width > 0)) return empty;

    function lumaAt(x, y) {
      return luma(pixelAt(rows[y], x));
    }
    function columnDark(x) {
      var dark = 0;
      for (var y = 0; y < height; y++) if (lumaAt(x, y) <= threshold) dark++;
      return dark / height >= darkRatio;
    }
    function rowDark(y) {
      var dark = 0;
      for (var x = 0; x < width; x++) if (lumaAt(x, y) <= threshold) dark++;
      return dark / width >= darkRatio;
    }
    var left = 0;
    while (left < width && columnDark(left)) left++;
    var right = 0;
    while (right < width - left && columnDark(width - 1 - right)) right++;
    var top = 0;
    while (top < height && rowDark(top)) top++;
    var bottom = 0;
    while (bottom < height - top && rowDark(height - 1 - bottom)) bottom++;

    function meanRegion(x0, x1, y0, y1) {
      var sum = 0;
      var n = 0;
      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          sum += lumaAt(x, y);
          n++;
        }
      }
      return n ? sum / n : 0;
    }

    var center = meanRegion(
      Math.floor(width * 0.3),
      Math.max(Math.floor(width * 0.3) + 1, Math.ceil(width * 0.7)),
      Math.floor(height * 0.3),
      Math.max(Math.floor(height * 0.3) + 1, Math.ceil(height * 0.7))
    );
    var minCols = Math.max(1, Math.round(width * minFraction));
    var minRows = Math.max(1, Math.round(height * minFraction));

    function sideOk(count, horizontal) {
      if (count < (horizontal ? minCols : minRows)) return false;
      var limit = horizontal ? width : height;
      if (count > limit * 0.45) return false;
      return true;
    }

    var leftMean = left ? meanRegion(0, left, 0, height) : 255;
    var rightMean = right ? meanRegion(width - right, width, 0, height) : 255;
    var topMean = top ? meanRegion(0, width, 0, top) : 255;
    var bottomMean = bottom ? meanRegion(0, width, height - bottom, height) : 255;
    var leftOn = sideOk(left, true) && center > leftMean + 18;
    var rightOn = sideOk(right, true) && center > rightMean + 18;
    var topOn = sideOk(top, false) && center > topMean + 18;
    var bottomOn = sideOk(bottom, false) && center > bottomMean + 18;
    if (left + right > width * 0.7) {
      leftOn = false;
      rightOn = false;
    }
    if (top + bottom > height * 0.7) {
      topOn = false;
      bottomOn = false;
    }
    return {
      left: leftOn,
      right: rightOn,
      top: topOn,
      bottom: bottomOn,
      leftCols: leftOn ? left : 0,
      rightCols: rightOn ? right : 0,
      topRows: topOn ? top : 0,
      bottomRows: bottomOn ? bottom : 0,
      width: width,
      height: height,
    };
  }

  function clampScale(n) {
    if (!(n > 0)) return 1;
    if (n > 8) return 8;
    return n;
  }

  function modeScales(rect, mode, zoom, bars) {
    var z = zoom > 0 ? zoom : 1;
    if (!rect) return { x: z, y: z };
    if (mode === "original") return { x: z, y: z };
    var fx = 1;
    var fy = 1;
    if (bars && bars.width && bars.height) {
      if ((bars.left || bars.right) && (bars.leftCols || 0) + (bars.rightCols || 0) > 0) {
        var contentW = bars.width - (bars.leftCols || 0) - (bars.rightCols || 0);
        if (contentW > bars.width * 0.5) fx = bars.width / contentW;
      }
      if ((bars.top || bars.bottom) && (bars.topRows || 0) + (bars.bottomRows || 0) > 0) {
        var contentH = bars.height - (bars.topRows || 0) - (bars.bottomRows || 0);
        if (contentH > bars.height * 0.5) fy = bars.height / contentH;
      }
      if (fx > 1.85) fx = 1.85;
      if (fy > 1.85) fy = 1.85;
      if (fx < 1.02) fx = 1;
      if (fy < 1.02) fy = 1;
    }
    if (mode === "stretch") {
      return {
        x: clampScale((rect.stretchX || 1) * fx * z),
        y: clampScale((rect.stretchY || 1) * fy * z),
      };
    }
    var cover = (rect.coverScale || 1) * Math.max(fx, fy) * z;
    cover = clampScale(cover);
    return { x: cover, y: cover };
  }

  function visualPlan(state) {
    state = state || {};
    var rect = state.rect;
    var mode = state.mode;
    var zoom = state.zoom > 0 ? state.zoom : 1;
    var panX = state.panX || 0;
    var panY = state.panY || 0;
    var bars = state.bars;
    var custom = zoom > 1.001 || panX !== 0 || panY !== 0;
    var container = !!(rect && (rect.sideBars || rect.letterBars));
    var frame = !!(bars && (bars.left || bars.right || bars.top || bars.bottom));
    var scales = modeScales(rect, mode, zoom, bars);
    if (!rect) return { kind: "none", scales: { x: 1, y: 1 } };
    if (mode === "original") return { kind: custom ? "zoom" : "none", scales: { x: zoom, y: zoom } };
    if (mode === "ambient") return { kind: container ? "ambient" : "none", scales: scales };
    if (container || frame || custom) {
      return { kind: mode === "stretch" ? "stretch" : "crop", scales: scales };
    }
    return { kind: "none", scales: scales };
  }

  root.UbbLayout = {
    MODES: MODES,
    pictureRect: pictureRect,
    visibleModes: visibleModes,
    nextMode: nextMode,
    ambientSampleDriver: ambientSampleDriver,
    shouldRunAmbientLoop: shouldRunAmbientLoop,
    detectBlackBars: detectBlackBars,
    modeScales: modeScales,
    visualPlan: visualPlan,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
