(function () {
  var WORKS = {
    elevator: {
      file: "works/elevator/index.html",
      base: "works/elevator/",
      title: "老楼装电梯，一楼说「不」怎么办？",
      origin: "https://mp.weixin.qq.com/s/yWDjrNmWKJctK0vl8O0TOQ#wechat_redirect"
    },
    impulse: {
      file: "works/impulse/index.html",
      base: "works/impulse/",
      title: "防止冲动，拒绝悲剧",
      origin: "https://mp.weixin.qq.com/s/WGhuxQnRJKtKiVoGiGV1qA#wechat_redirect"
    }
  };

  var page = document.getElementById("page");
  var viewer = document.getElementById("viewer");
  var viewerBody = document.getElementById("viewer-body");
  var viewerTitle = document.getElementById("viewer-title");
  var viewerOrigin = document.getElementById("viewer-origin");
  var viewerStatus = document.getElementById("viewer-status");
  var closeButton = document.getElementById("viewer-close");
  var nav = document.querySelector(".rail");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cache = {};
  var openId = "";
  var lastFocus = null;
  var opening = false;

  document.getElementById("print").addEventListener("click", function () {
    window.print();
  });

  window.addEventListener("scroll", function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }, { passive: true });

  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  var sections = navLinks.map(function (link) {
    return document.querySelector(link.getAttribute("href"));
  }).filter(Boolean);

  if ("IntersectionObserver" in window) {
    var ratios = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });
      var bestId = "";
      var best = 0;
      Object.keys(ratios).forEach(function (id) {
        if (ratios[id] > best) {
          best = ratios[id];
          bestId = id;
        }
      });
      navLinks.forEach(function (link) {
        if (link.getAttribute("href") === "#" + bestId) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] });
    sections.forEach(function (section) { spy.observe(section); });

  }

  function setStatus(message) {
    viewerStatus.hidden = !message;
    viewerStatus.textContent = message || "";
  }

  function absolutize(root, baseUrl) {
    root.querySelectorAll("[src]").forEach(function (el) {
      var raw = el.getAttribute("src");
      if (!raw || /^(data:|https?:|blob:)/i.test(raw)) return;
      el.setAttribute("src", new URL(raw, baseUrl).href);
    });
    root.querySelectorAll("[style]").forEach(function (el) {
      var style = el.getAttribute("style");
      if (!style || style.indexOf("url(") === -1) return;
      el.setAttribute("style", style.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (all, quote, path) {
        path = path.trim();
        if (/^(data:|https?:|blob:)/i.test(path)) return all;
        return 'url("' + new URL(path, baseUrl).href + '")';
      }));
    });
  }

  function remember(id, html) {
    var baseUrl = new URL(WORKS[id].base, window.location.href).href;
    var doc = new DOMParser().parseFromString(html, "text/html");
    var article = doc.querySelector(".wx");
    if (!article) throw new Error("missing article");
    article.removeAttribute("id");
    absolutize(article, baseUrl);
    cache[id] = article;
    return article;
  }

  function showArticle(id) {
    var node = cache[id].cloneNode(true);
    viewerBody.replaceChildren(node);
    setStatus("");
    if (!reduced) {
      node.classList.remove("is-shown");
      window.requestAnimationFrame(function () { node.classList.add("is-shown"); });
    }
  }

  function lockPage(locked) {
    document.body.classList.toggle("is-locked", locked);
    page.inert = locked;
    viewer.inert = !locked;
    viewer.setAttribute("aria-hidden", locked ? "false" : "true");
    viewer.classList.toggle("is-open", locked);
  }

  function openWork(id, push) {
    var work = WORKS[id];
    if (!work || opening) return;
    openId = id;
    lastFocus = document.activeElement;
    viewerTitle.textContent = work.title;
    viewerOrigin.href = work.origin;
    viewerBody.replaceChildren();
    setStatus("正在打开");
    lockPage(true);
    document.title = work.title + " · 余佳欣";
    window.setTimeout(function () { closeButton.focus(); }, reduced ? 0 : 280);
    if (push && location.hash !== "#work-" + id) {
      history.pushState({ work: id }, "", "#work-" + id);
    }
    if (cache[id]) {
      showArticle(id);
      return;
    }
    opening = true;
    fetch(work.file)
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then(function (html) {
        if (openId !== id) return;
        remember(id, html);
        showArticle(id);
      })
      .catch(function () {
        if (openId !== id) return;
        setStatus("");
        viewerBody.innerHTML = '<p class="viewer-error">这篇作品没有打开。<button type="button" id="viewer-retry">重试</button></p>';
        document.getElementById("viewer-retry").addEventListener("click", function () {
          delete cache[id];
          openWork(id, false);
        });
      })
      .then(function () { opening = false; });
  }

  function closeWork(fromPop) {
    if (!openId && !viewer.classList.contains("is-open")) return;
    openId = "";
    opening = false;
    lockPage(false);
    document.title = "余佳欣 · 新媒体编辑";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (!fromPop && location.hash.indexOf("#work-") === 0) history.back();
  }

  document.querySelectorAll("[data-work]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openWork(link.getAttribute("data-work"), true);
    });
  });

  closeButton.addEventListener("click", function () { closeWork(false); });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && openId) {
      event.preventDefault();
      closeWork(false);
    }
  });

  var touchX = 0;
  viewer.addEventListener("touchstart", function (event) {
    touchX = event.changedTouches[0].clientX;
  }, { passive: true });
  viewer.addEventListener("touchend", function (event) {
    var dx = event.changedTouches[0].clientX - touchX;
    if (touchX < 36 && dx > 72) closeWork(false);
  }, { passive: true });

  window.addEventListener("popstate", function () {
    var match = location.hash.match(/^#work-(elevator|impulse)$/);
    if (match) openWork(match[1], false);
    else closeWork(true);
  });

  var initial = location.hash.match(/^#work-(elevator|impulse)$/);
  if (initial) openWork(initial[1], false);
})();
