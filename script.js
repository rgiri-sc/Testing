const baseUrl = "https://dev.jointcommission.org";
// const baseUrl = "http://localhost:3000";
const domestic = "en-us";
const international = "en";
const local = domestic;

function clickHandler(event) {
  let anchor = event.target.closest("a");

  if (anchor?.href) {
    if (anchor.getAttribute("target") === "_blank") {
      window.open(anchor.href, "_blank");
      return;
    }
    const href = anchor.getAttribute("href");
    if (
      href &&
      !href.startsWith("http") &&
      !href.startsWith("//") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("#") &&
      !href.startsWith("javascript:") &&
      !href.startsWith("tel:")
    ) {
      event.preventDefault();
      let newUrl;
      if (href.startsWith("/")) {
        newUrl = `${baseUrl}${href}`;
      } else {
        newUrl = `${baseUrl}/${href}`;
      }
      window.location.href = newUrl;
    }
    if (href.startsWith("javascript:")) {
      return;
    }
    if (href.startsWith(baseUrl)) {
      window.location.href = href;
    }
  } else {
    console.error("No href attribute found for the clicked element.");
  }
}

function resolveUrlsAndImages(element) {
  const menuObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.tagName === "IMG") {
              processImageSrc(node, baseUrl);
            }
            if (node.tagName === "A") {
              // we have to add click event listener here
              node.addEventListener("click", clickHandler);
              processAnchorHref(node, baseUrl);
            }
            const images = node.querySelectorAll("img");
            images.forEach(function (img) {
              processImageSrc(img, baseUrl);
            });
            const anchors = node.querySelectorAll("a");
            anchors.forEach(function (anchor) {
              processAnchorHref(anchor, baseUrl);
            });
          }
        });
      } else if (mutation.type === "attributes") {
        const target = mutation.target;
        if (target.tagName === "IMG" && mutation.attributeName === "src") {
          processImageSrc(target, baseUrl);
        } else if (
          target.tagName === "A" &&
          mutation.attributeName === "href"
        ) {
          processAnchorHref(target, baseUrl);
        }
      }
    });
  });
  menuObserver.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href", "srcset"],
  });
}

// Function to disable Next.js hydration but allow search parameters
function disableNextJsHydration() {
  // Completely disable the Next.js router except for URL parameter updates
  if (window?.next?.router) {
    // Store original methods
    const originalPush = window.next.router.push;
    window.next.router.push = function (url, as, options) {
      // If URL dosen't start with /, add it
      if (!url.startsWith("/")) {
        return;
      }

      // only block navigation if it's a pathname is "/header"
      if (url.pathname === "/header") {
        url.pathname = url.pathname.replace("/header", "/");
        return originalPush.call(this, url, as, options);
      } else {
        if (
          url.startsWith(`/${domestic}`) ||
          url.startsWith(`/${international}`)
        ) {
          // return original method
          url = `${baseUrl}${url}`;
          return originalPush.call(this, url, as, options);
        }
        return originalPush.call(this, url, as, options);
      }
    };

    // Similar override for replace
    window.next.router.replace = function (url, as, options) {
      if (url === "/header?") {
        url.replace("/header?", "");
        return Promise.resolve(false);
      }

      // If it's just a search parameter update (same pathname)
      if (typeof url === "object" && url.query) {
        // Create URL with search parameters
        const searchParams = new URLSearchParams();
        for (const key in url.query) {
          if (url.query[key]) {
            searchParams.set(key, url.query[key]);
          }
        }

        // Update URL without page reload
        const newUrl = window.location.pathname + "?" + searchParams;
        window.history.replaceState({}, "", newUrl.replace("%3A", ":"));

        return Promise.resolve(true);
      }

      return Promise.resolve(false);
    };
  }
}

function networkListener() {
  const originalFetch = window.fetch;
  const redirectUrls = [
    // "/api/auth/session",
    // "/api/auth/_log",
    "/en-us/geolocation",
    "/en/geolocation",
    "/api/suggest-text",
  ];
  window.fetch = function (url, options) {
    if (
      redirectUrls.find((_url) => url.startsWith(_url)) &&
      typeof url === "string"
    ) {
      const newUrl = baseUrl + url;
      return originalFetch.call(this, newUrl, options);
    }

    if (url.startsWith("/_next") && typeof url === "string") {
      const newUrl = baseUrl?.endsWith("/")
        ? baseUrl
        : `${baseUrl}/` + "api/philosopher?file=" + baseUrl + url;
      return originalFetch.call(this, newUrl, options);
    }
    // match URLs that start with api/auth/*
    const isAuthUrl = /^\/api\/auth\//.test(url);
    if (isAuthUrl && typeof url === "string") {
      const newUrl = (url?.startsWith("/") ? baseUrl : `${baseUrl}/`) + url;
      return originalFetch.call(this, newUrl, {
        ...options,
        credentials: "include",
      });
    }
    return originalFetch.call(this, url, options);
  };
}

function updateUrls(htmlString) {
  htmlString = htmlString.replace(/href="\/api/g, 'href="' + baseUrl + "/api");
  htmlString = htmlString.replace(
    /src="\/_next/g,
    'src="' + baseUrl + "/_next"
  );
  htmlString = htmlString.replace(/srcset="[^"]*\/_next/g, (match) =>
    match.replace("/_next", baseUrl + "/_next")
  );
  htmlString = htmlString.replace(
    /href="\/en-us/g,
    'href="' + baseUrl + "/en-us"
  );
  htmlString = htmlString.replace(/href="\/en/g, 'href="' + baseUrl + "/en");
  htmlString = htmlString.replaceAll(
    baseUrl + "/_next",
    baseUrl + "/api/philosopher?file=" + baseUrl + "/_next"
  );
  return htmlString;
}

document.addEventListener("DOMContentLoaded", async function () {
  networkListener();
  const headerElement = document.getElementById("external-header");
  const footerContainer = document.getElementById("external-footer");

  // Hide header and footer initially
  if (headerElement) headerElement.style.display = "none";
  if (footerContainer) footerContainer.style.display = "none";

  try {
    const headerResponse = await fetch(`${baseUrl}/${local}/header`);
    if (!headerResponse.ok)
      throw new Error(`Failed to load header: ${headerResponse.status}`);
    const headerHTML = await headerResponse.text();
    const headerContainer = document.getElementById("external-header");
    if (!headerContainer) {
      console.error(
        "Header container element not found! Make sure you have <div id='external-header'></div> in your HTML."
      );
      return;
    }
    const shadowHeader = headerElement.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = updateUrls(headerHTML);
    shadowHeader.appendChild(template.content);

    shadowHeader.addEventListener("click", clickHandler);

    const footerUrl = `${baseUrl}/${local}/footer`;
    const footerResponse = await fetch(footerUrl);
    if (!footerResponse.ok)
      throw new Error(`Failed to load footer: ${footerResponse.status}`);
    const footerHTML = await footerResponse.text();

    if (!footerContainer) {
      console.error(
        "Footer container element not found! Make sure you have <div id='external-footer'></div> in your HTML."
      );
      return;
    }

    const shadowFooter = footerContainer.attachShadow({ mode: "open" });
    const templateFooter = document.createElement("template");
    templateFooter.innerHTML = updateUrls(footerHTML);
    shadowFooter.appendChild(templateFooter.content);

    const nextData = shadowHeader.getElementById("__NEXT_DATA__");
    document.body.appendChild(nextData);

    const originalGetElementById = document.getElementById;
    let headerResolved = false;
    let footerResolved = false;

    document.getElementById = function (id, ...args) {
      if (id === "__next") {
        const headerContainer = shadowHeader.getElementById(id, ...args);
        if (!headerResolved && headerContainer) {
          headerResolved = true;
          resolveUrlsAndImages(headerContainer);
          return headerContainer;
        }
        const footerContainer = shadowFooter.getElementById(id, ...args);
        if (!footerResolved && footerContainer) {
          footerResolved = true;
          resolveUrlsAndImages(footerContainer);
          return footerContainer;
        }
      }

      return originalGetElementById.call(document, id, ...args);
    };

    const originalQuerySelector = document.querySelector;
    document.querySelector = function (selector, ...args) {
      if (selector === "#__next_css__DO_NOT_USE__") {
        return shadowHeader.childNodes[0];
      }
      return originalQuerySelector.call(document, selector, ...args);
    };

    executeMatchingScripts(shadowHeader);

    setTimeout(() => {
      if (headerElement) headerElement.style.display = "block";

      if (footerContainer) footerContainer.style.display = "block";
    }, 500);

    resolveUrlsAndImages(shadowHeader);
    resolveUrlsAndImages(shadowFooter);

    setInterval(() => {
      const imgElements = shadowHeader.querySelectorAll("img");
      imgElements.forEach((img) => {
        processImageSrc(img, baseUrl);
      });

      const footerImgElements = shadowFooter.querySelectorAll("img");
      footerImgElements.forEach((img) => {
        processImageSrc(img, baseUrl);
      });
    }, 1000);

    setTimeout(() => {
      const linkElements = shadowHeader.querySelectorAll(
        'link[rel="stylesheet"]'
      );
      linkElements.forEach(async (link) => {
        try {
          const cssUrl = link.getAttribute("href");
          if (cssUrl) {
            const response = await fetch(cssUrl);
            const cssText = await response.text();

            let startIndex = 0;
            while (
              (startIndex = cssText.indexOf("@font-face{", startIndex)) !== -1
            ) {
              let endIndex = cssText.indexOf("}", startIndex);
              if (endIndex === -1) break;

              // Include the closing brace
              endIndex++;

              const fontFaceRule = cssText.substring(startIndex, endIndex);

              const styleElement = document.createElement("style");
              styleElement.textContent = fontFaceRule;
              document.head.appendChild(styleElement);

              startIndex = endIndex;
            }
          }
        } catch (error) {
          console.error("Error processing CSS file:", error);
        }
      });
    }, 1000);
  } catch (error) {
    console.error("Error loading external components:", error);
    // Show elements even if there's an error, to avoid permanently hidden elements
    if (headerElement) headerElement.style.display = "block";
    if (footerContainer) footerContainer.style.display = "block";
  }
});

function processAnchorHref(anchorElement, baseUrl) {
  if (anchorElement.hasAttribute("href")) {
    const href = anchorElement.getAttribute("href");
    if (
      href &&
      !href.startsWith("http") &&
      !href.startsWith("//") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("#") &&
      !href.startsWith("javascript:") &&
      !href.startsWith("tel:")
    ) {
      anchorElement.setAttribute("external-header-data-original-href", href);
      let newUrl;
      if (href.startsWith("/")) {
        newUrl = `${baseUrl}${href}`;
      } else {
        newUrl = `${baseUrl}/${href}`;
      }
      anchorElement.setAttribute("href", newUrl);
    }
  }
}

function processImageSrc(imgElement, baseUrl) {
  if (imgElement.hasAttribute("srcset")) {
    const srcset = imgElement.getAttribute("srcset");
    if (!srcset.startsWith(baseUrl + "/api/philosopher?file=")) {
      const _srcset = srcset
        .split(",")
        .map((part) => {
          const [url, descriptor] = part.trim().split(/\s+/);
          let modifiedUrl;

          // Handle /_next/image URLs in srcset
          if (url.startsWith("/_next/image")) {
            modifiedUrl = `${baseUrl}/api/philosopher?file=${baseUrl}${url}`;
          } else if (url.startsWith(baseUrl)) {
            modifiedUrl = url.replace(
              baseUrl,
              baseUrl + "/api/philosopher?file=" + baseUrl
            );
          } else if (url.startsWith("/_next")) {
            modifiedUrl = `${baseUrl}/api/philosopher?file=${baseUrl}${url}`;
          } else if (!url.startsWith("http") && !url.startsWith("//")) {
            // Handle relative URLs
            modifiedUrl = `${baseUrl}/api/philosopher?file=${baseUrl}${
              url.startsWith("/") ? url : "/" + url
            }`;
          } else {
            modifiedUrl = url;
          }

          return descriptor ? `${modifiedUrl} ${descriptor}` : modifiedUrl;
        })
        .join(",");

      imgElement.setAttribute("srcset", _srcset);
    }
  }

  if (imgElement.hasAttribute("src")) {
    const src = imgElement.getAttribute("src");
    if (!src.startsWith(baseUrl + "/api/philosopher?file=")) {
      // Special handling for /_next/image URLs
      if (src.startsWith("/_next/image")) {
        const newSrc = `${baseUrl}/api/philosopher?file=${baseUrl}${src}`;
        imgElement.src = newSrc;
        return;
      }

      const _src = src.startsWith(baseUrl)
        ? src.replace(baseUrl, baseUrl + "/api/philosopher?file=" + baseUrl)
        : src.startsWith("/_next")
        ? `${baseUrl}/api/philosopher?file=${baseUrl}${src}`
        : src;

      if (
        src &&
        !src.startsWith("http") &&
        !src.startsWith("//") &&
        !src.startsWith("data:") &&
        !src.startsWith("javascript:")
      ) {
        imgElement.src = _src;
        return;
      }
    }
  }
}

function processSrcsetValue(srcsetContent, baseUrl) {
  if (!srcsetContent) return srcsetContent;
  return srcsetContent
    .split(",")
    .map((srcSetPart) => {
      const parts = srcSetPart.trim().split(/\s+/);
      if (parts.length > 0) {
        let url = parts[0];
        if (
          url &&
          !url.startsWith("http") &&
          !url.startsWith("//") &&
          !url.startsWith("data:") &&
          !url.startsWith("javascript:")
        ) {
          if (url.startsWith("/")) {
            url = `${baseUrl}${url}`;
          } else {
            url = `${baseUrl}/${url}`;
          }
        }
        return parts.length > 1 ? `${url} ${parts.slice(1).join(" ")}` : url;
      }
      return srcSetPart;
    })
    .join(", ");
}

function executeMatchingScripts(container) {
  const scripts = container.querySelectorAll("script");
  scripts.forEach((oldScript, index) => {
    if (
      oldScript?.src?.includes("_next") ||
      oldScript?.id === "__NEXT_DATA__"
    ) {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.onload = () => {
        disableNextJsHydration();
      };
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    } else {
      oldScript.parentNode.removeChild(oldScript);
    }
  });
}
