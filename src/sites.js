(function (root) {
  var MIN_VIDEO_SIDE = 200;

  function pathOf(loc) {
    return (loc && loc.pathname) || "";
  }

  function hostOf(loc) {
    return (loc && loc.hostname) || "";
  }

  function isLargeEnough(width, height) {
    return width >= MIN_VIDEO_SIDE || height >= MIN_VIDEO_SIDE;
  }

  function boxOf(el) {
    if (!el || !el.getBoundingClientRect) return { w: 0, h: 0 };
    var rect = el.getBoundingClientRect();
    return { w: rect.width || 0, h: rect.height || 0 };
  }

  function playable(video) {
    if (!video) return false;
    if (video.readyState >= 1) return true;
    if (video.currentSrc || video.srcObject) return true;
    return false;
  }

  function videoScore(video, doc) {
    if (!video || video.tagName !== "VIDEO") return -1;
    var box = boxOf(video);
    if (!isLargeEnough(box.w, box.h)) return -1;
    if (!playable(video)) return -1;
    var area = box.w * box.h;
    var fs = doc && doc.fullscreenElement;
    if (fs && (fs === video || (fs.contains && fs.contains(video)))) area += 1e12;
    if (!video.paused && !video.ended && video.readyState >= 2) area *= 4;
    return area;
  }

  function findMainVideo(rootNode) {
    if (!rootNode || !rootNode.querySelectorAll) return null;
    var doc = rootNode.ownerDocument || rootNode;
    var list = rootNode.querySelectorAll("video");
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var score = videoScore(list[i], doc);
      if (score > bestScore) {
        bestScore = score;
        best = list[i];
      }
    }
    return best;
  }

  function areaIsTight(area, video) {
    var aw = area.clientWidth || 0;
    var ah = area.clientHeight || 0;
    var vw = video.clientWidth || 0;
    var vh = video.clientHeight || 0;
    if (aw < 8 || ah < 8 || vw < 8 || vh < 8) return false;
    if (aw > vw * 1.8 || ah > vh * 1.8) return false;
    return true;
  }

  function genericArea(doc) {
    var video = findMainVideo(doc);
    if (!video) return null;
    var fs = doc.fullscreenElement;
    if (fs && fs !== doc.body && fs !== doc.documentElement && fs !== video && fs.contains && fs.contains(video)) {
      if (areaIsTight(fs, video) || isLargeEnough(fs.clientWidth || 0, fs.clientHeight || 0)) return fs;
    }
    var parent = video.parentElement;
    if (!parent || parent === doc.body || parent === doc.documentElement) return null;
    if (!areaIsTight(parent, video)) return null;
    return parent;
  }

  var generic = {
    id: "generic",
    match: function (loc) {
      var protocol = (loc && loc.protocol) || "";
      return protocol === "http:" || protocol === "https:";
    },
    findArea: function (doc) {
      return genericArea(doc);
    },
    findVideo: function (area) {
      if (!area) return null;
      if (area.tagName === "VIDEO") return area;
      return findMainVideo(area);
    },
    scaleTargets: function (area) {
      if (!area || !area.querySelector) return [];
      var video = area.tagName === "VIDEO" ? area : area.querySelector("video");
      return video ? [video] : [];
    },
  };

  var sites = {
    bilibili: {
      id: "bilibili",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.bilibili.com" && host !== "bilibili.com") return false;
        return /^\/(video|bangumi\/play|list)\//.test(pathOf(loc));
      },
      findArea: function (doc) {
        return doc.querySelector(".bpx-player-video-area");
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        return Array.prototype.slice.call(
          area.querySelectorAll(".bpx-player-video-perch, .bpx-player-render-dm-wrap, .bpx-player-subtitle-wrap")
        );
      },
    },
    youtube: {
      id: "youtube",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.youtube.com" && host !== "youtube.com" && host !== "m.youtube.com") return false;
        var path = pathOf(loc);
        return path === "/watch" || path.indexOf("/shorts/") === 0;
      },
      findArea: function (doc) {
        return doc.querySelector("#movie_player, ytd-shorts-player, #shorts-player");
      },
      findVideo: function (area) {
        if (!area) return null;
        return area.querySelector("video.html5-main-video, video");
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var nodes = [];
        var video = area.querySelector("video.html5-main-video, video");
        if (video) nodes.push(video);
        var captions = area.querySelector(".ytp-caption-window-container");
        if (captions) nodes.push(captions);
        return nodes;
      },
    },
    twitch: {
      id: "twitch",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.twitch.tv" && host !== "twitch.tv") return false;
        return /^\/videos\/\d+/.test(pathOf(loc));
      },
      findArea: function (doc) {
        var video = doc.querySelector(".video-player video");
        if (!video) return null;
        return video.closest(".video-player") || video.parentElement;
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var video = area.querySelector("video");
        return video ? [video] : [];
      },
    },
    netflix: {
      id: "netflix",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.netflix.com" && host !== "netflix.com") return false;
        return /^\/watch\//.test(pathOf(loc));
      },
      findArea: function (doc) {
        return doc.querySelector("[data-uia='watch-video-player-view']");
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var video = area.querySelector("video");
        return video ? [video] : [];
      },
    },
    prime: {
      id: "prime",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.primevideo.com" && host !== "primevideo.com") return false;
        return /^\/(gp\/video\/detail|detail|region\/[^/]+\/detail|region\/[^/]+\/gp\/video\/detail)\//.test(pathOf(loc));
      },
      findArea: function (doc) {
        return doc.querySelector(".atvwebplayersdk-video-player, .webPlayerSDKContainer");
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var video = area.querySelector("video");
        return video ? [video] : [];
      },
    },
    disney: {
      id: "disney",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "www.disneyplus.com" && host !== "disneyplus.com") return false;
        var path = pathOf(loc);
        return path.indexOf("/play/") === 0 || path.indexOf("/video/") === 0;
      },
      findArea: function (doc) {
        return doc.querySelector(".btm-media-player, .btm-media-client-element");
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var video = area.querySelector("video");
        return video ? [video] : [];
      },
    },
    max: {
      id: "max",
      match: function (loc) {
        var host = hostOf(loc);
        if (host !== "play.max.com") return false;
        return /^\/video\/watch\//.test(pathOf(loc));
      },
      findArea: function (doc) {
        return doc.querySelector("[data-testid='player-container'], .bt-player");
      },
      findVideo: function (area) {
        return area ? area.querySelector("video") : null;
      },
      scaleTargets: function (area) {
        if (!area) return [];
        var video = area.querySelector("video");
        return video ? [video] : [];
      },
    },
  };

  function current(loc) {
    var order = ["bilibili", "youtube", "twitch", "netflix", "prime", "disney", "max"];
    for (var i = 0; i < order.length; i++) {
      if (sites[order[i]].match(loc)) return sites[order[i]];
    }
    return null;
  }

  function resolve(loc) {
    return current(loc) || (generic.match(loc) ? generic : null);
  }

  root.UbbSites = {
    MIN_VIDEO_SIDE: MIN_VIDEO_SIDE,
    isLargeEnough: isLargeEnough,
    sites: sites,
    current: current,
    resolve: resolve,
    findMainVideo: findMainVideo,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
