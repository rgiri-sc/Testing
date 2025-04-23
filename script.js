const baseUrl = "https://dev.jointcommission.org";
// const baseUrl = "http://localhost:3000";
function clickHandler(event) {
  alert("Clicked!");
  let anchor = event.target.closest("a");
  if (anchor && anchor.href) {
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
      console.log("Navigating to:", newUrl);
      alert(`Navigating to: ${newUrl}`);
      window.location.href = newUrl;
    }
  } else {
    alert("No href attribute found for the clicked element.");
  }
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
      if (url.includes("api/suggest-text")) {
        // Extract the path part
        let path = url;
        if (url.startsWith(currentOrigin)) {
          path = url.substring(currentOrigin.length);
        }

        // Create new URL with baseUrl
        modifiedUrl = `${baseUrl}${path}`;
        console.log(`Redirecting fetch from ${url} to ${modifiedUrl}`);
      }
    }

    // Call original fetch with modified URL
    return originalFetch.call(this, modifiedUrl, options);
  };

  console.log("API call interception enabled");
}

// Add this function to completely disable Next.js hydration
function disableNextJsHydration() {
  console.log("Disabling Next.js hydration");

  // Override Next.js functions that cause reloading
  // window.__NEXT_DATA__ = { props: { pageProps: {} } };
  window.__NEXT_LOADED_PAGES__ = [];
  window.__NEXT_REGISTER_PAGE = function () {
    return;
  };
  // window.__NEXT_P = [];

  // Completely disable the Next.js router
  if (window.next && window.next.router) {
    window.next.router.ready = function () {
      return Promise.resolve();
    };
    window.next.router.push = function () {
      return Promise.resolve(false);
    };
    window.next.router.replace = function () {
      return Promise.resolve(false);
    };
    window.next.router.reload = function () {
      return;
    };
    window.next.router.back = function () {
      return;
    };
    window.next.router.prefetch = function () {
      return Promise.resolve();
    };
    window.next.router.beforePopState = function () {
      return;
    };
    console.log("Next.js router methods disabled");

    if (window.__NEXT_DATA__) {
      // Ensure assetPrefix and basePath are set correctly
      window.__NEXT_DATA__.assetPrefix = baseUrl;
      window.__NEXT_DATA__.basePath = baseUrl;
      window.__NEXT_DATA__.hostname = baseUrl;
      console.log("Next.js data:", window.__NEXT_DATA__.basePath);
    }

    // If Next.js runtime config exists, modify it
    if (window.__NEXT_RUNTIME_CONFIG__) {
      console.log(
        "Next.js runtime config found",
        window.__NEXT_RUNTIME_CONFIG__
      );

      window.__NEXT_RUNTIME_CONFIG__.assetPrefix = baseUrl;
      window.__NEXT_RUNTIME_CONFIG__.basePath = baseUrl;
    }
  }

  // Prevent pushState/replaceState from being used by Next.js
  const originalPushState = history.pushState;
  history.pushState = function () {
    console.log("Prevented navigation via pushState", arguments);
    // Return without applying the original function
    return;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    console.log("Prevented navigation via replaceState", arguments);
    // Return without applying the original function
    return;
  };

  // Store original location if needed
  if (!window.originalLocation) {
    window.originalLocation = window.location;
    window._location = {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      reload: function () {
        console.log("Prevented page reload");
      },
    };
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  disableNextJsHydration();

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
      console.log("MutationObserver callback executed");
    });
    menuObserver.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "srcset"],
    });
  }

  const headerElement = document.getElementById("external-header");
  const footerContainer = document.getElementById("external-footer");

  if (headerElement) {
    console.log("Setting up MutationObserver for header element");
    resolveUrlsAndImages(headerElement);
    console.log("MutationObserver started for header element");
  } else {
    console.warn("Header element not found for observation");
  }

  if (footerContainer) {
    console.log("Setting up MutationObserver for footer container");
    resolveUrlsAndImages(footerContainer);
    console.log("MutationObserver started for footer container");
  } else {
    console.warn("Footer container not found for observation");
  }

  try {
    console.log("DOM fully loaded");
    console.log("Fetching header from:", `${baseUrl}/en/header`);

    const headerResponse = await fetch(`${baseUrl}/en/header`);

    if (!headerResponse.ok)
      throw new Error(`Failed to load header: ${headerResponse.status}`);
    const headerHTML = await headerResponse.text();
    console.log("Raw header HTML received, length:", headerHTML.length);

    // Process the HTML to remove hydration scripts
    const processedHeaderHtml = processRelativeUrls(headerHTML, baseUrl);
    const sanitizedHeaderHtml = removeHydrationScripts(processedHeaderHtml);

    // Use a document fragment to avoid full page reloads
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = sanitizedHeaderHtml;

    // Move nodes to fragment
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    // Clear and append
    headerElement.innerHTML = "";
    headerElement.appendChild(fragment);

    console.log("Header HTML inserted into DOM");

    const footerUrl = `${baseUrl}/en/footer`;
    console.log("Fetching footer from:", footerUrl);
    const footerResponse = await fetch(footerUrl);
    if (!footerResponse.ok)
      throw new Error(`Failed to load footer: ${footerResponse.status}`);
    const footerHTML = await footerResponse.text();

    // Process the footer HTML
    const processedFooterHtml = processRelativeUrls(footerHTML, baseUrl);
    const sanitizedFooterHtml = removeHydrationScripts(processedFooterHtml);

    // Use a document fragment for footer too
    const footerFragment = document.createDocumentFragment();
    const footerTempDiv = document.createElement("div");
    footerTempDiv.innerHTML = sanitizedFooterHtml;

    while (footerTempDiv.firstChild) {
      footerFragment.appendChild(footerTempDiv.firstChild);
    }

    footerContainer.innerHTML = "";
    footerContainer.appendChild(footerFragment);

    console.log("Footer HTML inserted into DOM");

    // Execute only essential scripts
    executeEssentialScripts(headerElement);

    console.log("Component scripts executed");
  } catch (error) {
    console.error("Error loading external components:", error);
  }

  function removeHydrationScripts(html) {
    return html;
    /*     return html
      .replace(/<script[^>]*>[\s\S]*?ReactDOM\.hydrate[\s\S]*?<\/script>/g, "")
      .replace(/<script[^>]*>[\s\S]*?__NEXT_P\.push[\s\S]*?<\/script>/g, "")
      .replace(
        /<script[^>]*>[\s\S]*?__NEXT_LOADED_PAGES__[\s\S]*?<\/script>/g,
        ""
      )
      .replace(
        /<script[^>]*>[\s\S]*?__NEXT_REGISTER_PAGE[\s\S]*?<\/script>/g,
        ""
      )
      .replace(/<script[^>]*>[\s\S]*?window\.__NEXT_P[\s\S]*?<\/script>/g, ""); */
    // .replace(/<script id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/g, "");
  }

  function executeEssentialScripts(container) {
    const scripts = container.querySelectorAll("script");
    console.log(`Found ${scripts.length} scripts in container`);
    for (let i = 0; i < scripts.length; i++) {
      const oldScript = scripts[i];
      const index = i;

      if (
        (oldScript.src && oldScript.src.includes("_next")) ||
        oldScript.id === "__NEXT_DATA__"
      ) {
        console.log(
          `Executing script ${index + 1}:`,
          oldScript.src || oldScript.id || "inline script"
        );
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.async = true;
        newScript.textContent = oldScript.textContent;

        if (oldScript.src.match(/_next\/static\/chunks\/main/)) {
          newScript.onload = function () {
            console.log("Loaded main.js");
            disableNextJsHydration();
          };
        }
        oldScript.parentNode.removeChild(oldScript);
        if (oldScript.id === "__NEXT_DATA__") {
          newScript.onload = function () {
            console.log("Loaded __NEXT_DATA__");
            disableNextJsHydration();
          };
          headerElement.appendChild(newScript);
        } else {
          newScript.onload = function () {
            console.log("Loaded script", oldScript.src);
            disableNextJsHydration();
          };
          newScript.onerror = function () {
            console.error("Error loading script", oldScript.src);
          };
          document.head.appendChild(newScript);
        }
      } else {
        console.log(`Removing non-matching script ${index + 1}`);
        oldScript.parentNode.removeChild(oldScript);
      }
    }

    disableNextJsHydration();
  }

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

        // Add click handler to prevent default navigation
        anchorElement.addEventListener("click", function (e) {
          e.preventDefault();
          console.log("Navigation intercepted to:", newUrl);
          // You can handle navigation here if needed
          window.open(newUrl, "_self");
        });
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

  function processRelativeUrls(html, baseUrl) {
    console.log("Processing relative URLs in HTML content...");
    try {
      html = html.replace(
        /(href|src)=(["'])(\/[^"']+|[^"':][^"']+)(["'])/gi,
        function (match, attr, quote, url, endQuote) {
          if (!url) return match;
          url = url.replace(/&/g, "&");

          // Handle _next/static/media paths
          if (url.match(/_next\/static\/media/)) {
            try {
              url = url.replace(
                /_next\/static\/media/g,
                "api/_next/static/media"
              );
              return `${attr}=${quote}${url}${endQuote}`;
            } catch (e) {
              console.warn("Failed to process URL:", url, e);
            }
          }

          // Skip URLs that are already absolute or special protocols
          if (
            url.startsWith("http") ||
            url.startsWith("//") ||
            url.startsWith("mailto:") ||
            url.startsWith("#") ||
            url.startsWith("javascript:") ||
            url.startsWith("tel:") ||
            url.startsWith("data:")
          ) {
            return match;
          }

          if (url.startsWith("/")) {
            url = `${baseUrl}${url}`;
          } else {
            url = `${baseUrl}/${url}`;
          }

          return `${attr}=${quote}${url}${endQuote}`;
        }
      );

      console.log("URL processing complete");
      return html;
    } catch (error) {
      console.error("Error in processRelativeUrls:", error);
      return html;
    }
  }
});
