const baseUrl = "https://dev.jointcommission.org";
// const baseUrl = "http://localhost:3000";
const domestic = "en-us";
const international = "en";
const local = domestic;

function clickHandler(event) {
  // alert("Clicked!");
  let anchor = event.target.closest("a");

  if (anchor && anchor.href) {
    if (anchor.getAttribute("target") === "_blank") {
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
    //console.log("MutationObserver callback executed");
  });
  menuObserver.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href", "srcset"],
  });
}

function interceptApiCalls() {
  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch to redirect API calls
  window.fetch = function (url, options) {
    let modifiedUrl = url;

    // Check if this is a relative URL or one from the current origin
    if (typeof url === "string") {
      const currentOrigin = window.location.origin;

      // If it's a relative URL or from current origin but should be from baseUrl
      if (
        url.includes("api/suggest-text") ||
        url.includes("api/auth/session") ||
        url.includes("_next/data")
      ) {
        // Extract the path part
        let path = url;
        if (url.startsWith(currentOrigin)) {
          path = url.substring(currentOrigin.length);
        }

        // Create new URL with baseUrl
        modifiedUrl = `${baseUrl}${path}`;
        //console.log(`Redirecting fetch from ${url} to ${modifiedUrl}`);
      }
    }

    // Call original fetch with modified URL
    return originalFetch.call(this, modifiedUrl, options);
  };

  //console.log("API call interception enabled");
}

// Function to disable Next.js hydration but allow search parameters
function disableNextJsHydration() {
  //console.log("Disabling Next.js hydration with search parameter support");

  // Completely disable the Next.js router except for URL parameter updates
  if (window.next && window.next.router) {
    // Store original methods
    const originalPush = window.next.router.push;
    const originalReplace = window.next.router.replace;
    // Override push to only allow search parameter updates

    window.next.router.push = function (url, as, options) {
      //console.log("next.router.push called with:", url, as, options);

      // If URL dosen't start with /, add it
      if (!url.startsWith("/")) {
        return;
      }

      // only block navigation if it's a pathname is "/header"
      if (url.pathname === "/header") {
        //console.log("Blocking navigation to:", url);
        return Promise.resolve(false);
      } else {
        //console.log("Allowing navigation to:", url);
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
      //console.log("replace: Blocking navigation to: url: ", url);
      //console.log("replace: Blocking navigation to: as: ", as);
      //console.log("replace: Blocking navigation to: url: ", options);

      if (url?.query?.includes("rfkid_") || url?.query?.includes("rfkid_")) {
        // return original method
        return originalReplace(url, as, options);
      }
      // If it's just a search parameter update (same pathname)
      if (typeof url === "object" && url.query) {
        //console.log("Allowing search parameter update:", url.query);

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

    //console.log("Next.js router methods modified to allow search parameters");
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  interceptApiCalls();
  const headerElement = document.getElementById("external-header");
  const footerContainer = document.getElementById("external-footer");

  if (headerElement) {
    //console.log("Setting up MutationObserver for header element");
    resolveUrlsAndImages(headerElement);
    //console.log("MutationObserver started for header element");
  } else {
    console.warn("Header element not found for observation");
  }

  if (footerContainer) {
    //console.log("Setting up MutationObserver for footer container");
    resolveUrlsAndImages(footerContainer);
    //console.log("MutationObserver started for footer container");
  } else {
    console.warn("Footer container not found for observation");
  }

  try {
    //console.log("DOM fully loaded");
    //console.log("Fetching header from:", `${baseUrl}/${local}/header`);
    const headerResponse = await fetch(`${baseUrl}/${local}/header`);
    if (!headerResponse.ok)
      throw new Error(`Failed to load header: ${headerResponse.status}`);
    const headerHTML = await headerResponse.text();
    //console.log("Raw header HTML received, length:", headerHTML.length);
    //console.log("Header HTML preview:", headerHTML.substring(0, 200) + "...");
    const headerContainer = document.getElementById("external-header");
    if (!headerContainer) {
      console.error(
        "Header container element not found! Make sure you have <div id='external-header'></div> in your HTML."
      );
      return;
    }
    headerContainer.addEventListener("click", clickHandler);
    headerContainer.innerHTML = headerHTML;
    //console.log("Header HTML inserted into DOM");

    const footerUrl = `${baseUrl}/${local}/footer`;
    //console.log("Fetching footer from:", footerUrl);
    const footerResponse = await fetch(footerUrl);
    if (!footerResponse.ok)
      throw new Error(`Failed to load footer: ${footerResponse.status}`);
    const footerHTML = await footerResponse.text();
    //console.log("Raw footer HTML received, length:", footerHTML.length);

    if (!footerContainer) {
      console.error(
        "Footer container element not found! Make sure you have <div id='external-footer'></div> in your HTML."
      );
      return;
    }
    //console.log("Footer container found");
    footerContainer.innerHTML = footerHTML;
    //console.log("Footer HTML inserted into DOM");

    executeMatchingScripts(headerContainer);
    //console.log("Header scripts executed");
  } catch (error) {
    console.error("Error loading external components:", error);
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
  if (imgElement.hasAttribute("src")) {
    const src = imgElement.getAttribute("src");
    if (
      src &&
      !src.startsWith("http") &&
      !src.startsWith("//") &&
      !src.startsWith("data:") &&
      !src.startsWith("javascript:")
    ) {
      let newSrc;
      if (src.startsWith("/")) {
        newSrc = `${baseUrl}${src}`;
      } else {
        newSrc = `${baseUrl}/${src}`;
      }
      imgElement.src = newSrc;
    }
  }
  if (imgElement.hasAttribute("srcset")) {
    const srcset = imgElement.getAttribute("srcset");
    imgElement.setAttribute("srcset", processSrcsetValue(srcset, baseUrl));
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
  //console.log(`Found ${scripts.length} scripts in container`);
  scripts.forEach((oldScript, index) => {
    if (
      (oldScript.src && oldScript.src.includes("_next")) ||
      oldScript.id === "__NEXT_DATA__"
    ) {
      /*console.log(
        `Executing script ${index + 1}:`,
        oldScript.src || oldScript.id || "inline script"
      );*/
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.onload = () => {
        //console.log(`Executed script ${index + 1}:`, oldScript.src || "inline");
        disableNextJsHydration();
      };
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    } else {
      //console.log(`Removing non-matching script ${index + 1}`);
      oldScript.parentNode.removeChild(oldScript);
    }
  });
}

function processRelativeUrls(html, baseUrl) {
  //console.log("Processing relative URLs in HTML content...");
  try {
    html = html.replace(
      /(href)=(["'])(\/[^"']+|[^"':][^"']+)(["'])/gi,
      function (match, attr, quote, url, endQuote) {
        if (!url) return match;
        url = url.replace(/&amp;/g, "&");
        if (url.startsWith(`${baseUrl}/_next/static/media`)) {
          return `${attr}=${quote}${url?.replace(
            "_next/static/media",
            "api/_next/static/media"
          )}${endQuote}`;
        }
      }
    );
    //console.log("URL processing complete");
    return html;
  } catch (error) {
    console.error("Error in processRelativeUrls:", error);
  }
}
function domBasedProcessRelativeUrls(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("img").forEach((img) => {
    if (
      img.src &&
      !img.src.startsWith("http") &&
      !img.src.startsWith("//") &&
      !img.src.startsWith("data:")
    ) {
      img.src = img.src.startsWith("/")
        ? `${baseUrl}${img.src}`
        : `${baseUrl}/${img.src}`;
    }
    if (img.srcset) {
      img.srcset = processSrcsetValue(img.srcset, baseUrl);
    }
  });
  doc.querySelectorAll("a").forEach((a) => {
    if (
      a.href &&
      !a.href.startsWith("http") &&
      !a.href.startsWith("//") &&
      !a.href.startsWith("mailto:") &&
      !a.href.startsWith("#") &&
      !a.href.startsWith("javascript:") &&
      !a.href.startsWith("tel:")
    ) {
      a.href = a.href.startsWith("/")
        ? `${baseUrl}${a.href}`
        : `${baseUrl}/${a.href}`;
    }
  });
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    if (
      link.href &&
      !link.href.startsWith("http") &&
      !link.href.startsWith("//")
    ) {
      link.href = link.href.startsWith("/")
        ? `${baseUrl}${link.href}`
        : `${baseUrl}/${link.href}`;
    }
  });
  doc.querySelectorAll("script[src]").forEach((script) => {
    if (
      script.src &&
      !script.src.startsWith("http") &&
      !script.src.startsWith("//")
    ) {
      script.src = script.src.startsWith("/")
        ? `${baseUrl}${script.src}`
        : `${baseUrl}/${script.src}`;
    }
  });
  return doc.documentElement.outerHTML;
}
