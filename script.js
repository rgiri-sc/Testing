const baseUrl = "https://dev.jointcommission.org";

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
    console.log("MutationObserver callback executed");
  });
  menuObserver.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href", "srcset"],
  });
}

document.addEventListener("DOMContentLoaded", async function () {
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
    console.log("Header HTML preview:", headerHTML.substring(0, 200) + "...");
    const headerContainer = document.getElementById("external-header");
    if (!headerContainer) {
      console.error(
        "Header container element not found! Make sure you have <div id='external-header'></div> in your HTML."
      );
      return;
    }
    headerContainer.innerHTML = headerHTML;
    console.log("Header HTML inserted into DOM");

    const footerUrl = `${baseUrl}/en/footer`;
    console.log("Fetching footer from:", footerUrl);
    const footerResponse = await fetch(footerUrl);
    if (!footerResponse.ok)
      throw new Error(`Failed to load footer: ${footerResponse.status}`);
    const footerHTML = await footerResponse.text();
    console.log("Raw footer HTML received, length:", footerHTML.length);

    if (!footerContainer) {
      console.error(
        "Footer container element not found! Make sure you have <div id='external-footer'></div> in your HTML."
      );
      return;
    }
    console.log("Footer container found");
    footerContainer.innerHTML = footerHTML;
    console.log("Footer HTML inserted into DOM");

    executeMatchingScripts(headerContainer);
    console.log("Header scripts executed");
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
function executeMatchingScripts(container) {
  const scripts = container.querySelectorAll("script");
  console.log(`Found ${scripts.length} scripts in container`);
  scripts.forEach((oldScript, index) => {
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
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    } else {
      console.log(`Removing non-matching script ${index + 1}`);
      oldScript.parentNode.removeChild(oldScript);
    }
  });
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
      /(src|href)=(["'])(\/[^"']+|[^"':][^"']+)(["'])/gi,
      function (match, attr, quote, url, endQuote) {
        if (!url) return match;
        url = url.replace(/&/g, "&");
        if (
          url.startsWith("http") ||
          url.startsWith("//") ||
          url.startsWith("mailto:") ||
          url.startsWith("#") ||
          url.startsWith("data:") ||
          url.startsWith("javascript:") ||
          url.startsWith("tel:")
        )
          return match;
        try {
          url = decodeURIComponent(url);
        } catch (e) {
          console.warn("Failed to decode URL:", url, e);
        }
        if (url.startsWith("/")) {
          return `${attr}=${quote}${baseUrl}${url}${endQuote}`;
        } else {
          return `${attr}=${quote}${baseUrl}/${url}${endQuote}`;
        }
      }
    );
    html = html.replace(
      /srcset=(["'])(.*?)(["'])/gi,
      function (match, openQuote, srcsetContent, closeQuote) {
        if (!srcsetContent) return match;
        const processedSrcset = srcsetContent
          .split(",")
          .map((srcSetPart) => {
            const parts = srcSetPart.trim().split(/\s+/);
            if (parts.length > 0) {
              let url = parts[0];
              if (!url) return srcSetPart;
              url = url.replace(/&/g, "&");
              if (
                !url.startsWith("http") &&
                !url.startsWith("//") &&
                !url.startsWith("data:") &&
                !url.startsWith("javascript:")
              ) {
                try {
                  url = decodeURIComponent(url);
                } catch (e) {
                  console.warn("Failed to decode URL in srcset:", url, e);
                }
                if (url.startsWith("/")) {
                  url = `${baseUrl}${url}`;
                } else {
                  url = `${baseUrl}/${url}`;
                }
              }
              return parts.length > 1
                ? `${url} ${parts.slice(1).join(" ")}`
                : url;
            }
            return srcSetPart;
          })
          .join(", ");
        return `srcset=${openQuote}${processedSrcset}${closeQuote}`;
      }
    );
    console.log("URL processing complete");
    return html;
  } catch (error) {
    console.error("Error in processRelativeUrls:", error);
    try {
      console.log("Trying DOM-based approach as fallback");
      return domBasedProcessRelativeUrls(html, baseUrl);
    } catch (domError) {
      console.error("DOM-based approach also failed:", domError);
      return html;
    }
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