function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function safeUrl(value, imageOnly = false) {
  const raw = value.trim();

  // 允許頁面錨點，例如 #
  if (!imageOnly && raw.startsWith("#")) {
    return raw;
  }

  try {
    const url = new URL(raw);

    if (imageOnly) {
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    }

    return ["https:", "http:", "mailto:", "tel:", "skype:"].includes(
      url.protocol,
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function parseInline(input, depth = 0) {
  if (depth > 10) return escapeHtml(input);

  let result = "";
  let i = 0;

  const rules = [
    {
      re: /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?/,
      render: (m) => {
        const url = safeUrl(m[2], true);
        if (!url) return escapeHtml(m[0]);

        const options = m[3] || "";

        const widthMatch = options.match(
          /(?:^|\s)width=(\d+(?:\.\d+)?(?:px|%|em|rem)?)(?=\s|$)/i,
        );

        const alignMatch = options.match(
          /(?:^|\s)align=(left|center|right)(?=\s|$)/i,
        );

        const roundMatch = options.match(
          /(?:^|\s)round=(\d+(?:\.\d+)?(?:px|%|em|rem)?)(?=\s|$)/i,
        );

        let width = "auto";

        if (widthMatch) {
          const value = widthMatch[1];
          const number = parseFloat(value);
          const unit = value.match(/(px|%|em|rem)$/i)?.[1] || "px";

          if (number > 0) {
            width = number + unit;
          }
        }

        let round = "";

        if (roundMatch) {
          const value = roundMatch[1];
          const number = parseFloat(value);
          const unit = value.match(/(px|%|em|rem)$/i)?.[1] || "px";

          if (number >= 0) {
            round = number + unit;
          }
        }

        const align = alignMatch ? alignMatch[1].toLowerCase() : "auto";

        let style = "max-width:100%;height:auto;";

        if (width !== "auto") {
          style += "width:" + width + ";";
        }

        if (round) {
          style += "border-radius:" + round + ";";
        }

        if (align === "left") {
          style += "display:block;margin-left:0;margin-right:auto;";
        } else if (align === "center") {
          style += "display:block;margin-left:auto;margin-right:auto;";
        } else if (align === "right") {
          style += "display:block;margin-left:auto;margin-right:0;";
        }

        return (
          '<img src="' +
          escapeHtml(url) +
          '" alt="' +
          escapeHtml(m[1]) +
          '" loading="lazy" style="' +
          style +
          '">'
        );
      },
    },
    {
      re: /^\[([^\]]+)\]\(([^)]+)\)/,
      render: (m, d) => {
        const target = m[2].trim();
        const label = parseInline(m[1], d + 1);

        if (target.startsWith("clipboard:")) {
          const value = target.slice("clipboard:".length);

          return (
            "<a onclick=\"_clipboard(event, '" +
            escapeHtml(value) +
            "'); return false;\">" +
            label +
            "</a>"
          );
        }

        if (target.startsWith("copy:")) {
          const value = target.slice("copy:".length);

          return (
            "<a onclick=\"_copy(event, '" +
            escapeHtml(value) +
            "'); return false;\">" +
            label +
            "</a>"
          );
        }

        // Carrd 與瀏覽器指令：只允許明確列出的功能
        const actions = {
          "browser:back": "history.back();",
          "browser:forward": "history.forward();",
          "browser:top": "_scrollToTop();",
          "browser:print": "window.print();",
          "section:next": "_nextSection();",
          "section:previous": "_previousSection();",
          "section:first": "_firstSection();",
          "section:last": "_lastSection();",
          "scrollpoint:next": "_nextScrollPoint(event);",
          "scrollpoint:previous": "_previousScrollPoint(event);",
          "scrollpoint:first": "_firstScrollPoint(event);",
          "scrollpoint:last": "_lastScrollPoint(event);",
        };

        if (Object.prototype.hasOwnProperty.call(actions, target)) {
          return (
            '<a onclick="' +
            actions[target] +
            'return false;">' +
            label +
            "</a>"
          );
        }

        // 複製文字
        if (target.startsWith("copy:") || target.startsWith("clipboard:")) {
          const value = target.slice(target.indexOf(":") + 1);

          if (!value) return label;

          return (
            '<a data-cms-copy="' + escapeHtml(value) + '">' + label + "</a>"
          );
        }

        // 一般網址與頁面錨點
        const safe = safeUrl(target);
        if (!safe) return label;

        if (safe.startsWith("#")) {
          return '<a href="' + safe + '">' + label + "</a>";
        }

        return (
          '<a href="' +
          safe +
          '" target="_blank" rel="noopener noreferrer">' +
          label +
          "</a>"
        );
      },
    },
    {
      re: /^\[([\s\S]+?)\]\{(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\}/,
      render: (m, d) =>
        '<span style="color:' +
        m[2] +
        '">' +
        parseInline(m[1], d + 1) +
        "</span>",
    },
    {
      re: /^`([^`]+)`/,
      render: (m) => "<code>" + escapeHtml(m[1]) + "</code>",
    },
    {
      re: /^\*\*([\s\S]+?)\*\*/,
      render: (m, d) => "<strong>" + parseInline(m[1], d + 1) + "</strong>",
    },
    {
      re: /^__([\s\S]+?)__/,
      render: (m, d) => "<u>" + parseInline(m[1], d + 1) + "</u>",
    },
    {
      re: /^\*([^*]+?)\*/,
      render: (m, d) => "<em>" + parseInline(m[1], d + 1) + "</em>",
    },
    {
      re: /^_([^_]+?)_/,
      render: (m, d) => "<em>" + parseInline(m[1], d + 1) + "</em>",
    },
    {
      re: /^~~([\s\S]+?)~~/,
      render: (m, d) => "<s>" + parseInline(m[1], d + 1) + "</s>",
    },
    {
      re: /^==([\s\S]+?)==/,
      render: (m, d) => "<mark>" + parseInline(m[1], d + 1) + "</mark>",
    },
    {
      re: /^\|\|([\s\S]+?)\|\|/,
      render: (m, d) =>
        "<spoiler-text>" + parseInline(m[1], d + 1) + "</spoiler-text>",
    },
    {
      re: /^~([^~\n]+?)~/,
      render: (m, d) => "<sub>" + parseInline(m[1], d + 1) + "</sub>",
    },
    {
      re: /^\^([^^\n]+?)\^/,
      render: (m, d) => "<sup>" + parseInline(m[1], d + 1) + "</sup>",
    },
  ];

  while (i < input.length) {
    // Carrd 類型的文字跳脫語法
    if (input.startsWith("\\n", i)) {
      result += "<br>";
      i += 2;
      continue;
    }

    if (input.startsWith("\\s", i)) {
      result += "&nbsp;";
      i += 2;
      continue;
    }

    let matched = false;

    for (const rule of rules) {
      const match = input.slice(i).match(rule.re);

      if (match) {
        result += rule.render(match, depth);
        i += match[0].length;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    result += escapeHtml(input[i]);
    i++;
  }

  return result;
}

export function markdownToHtml(markdown) {
  const lines = String(markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect opening fenced code blocks (backticks or tildes).
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);

    if (fenceMatch) {
      const fence = fenceMatch[1];
      const fenceChar = fence[0];
      const fenceLength = fence.length;
      const language = fenceMatch[2].trim().split(/\s+/)[0] || "";

      const codeLines = [];
      i++;

      // Collect code until a matching closing fence is found.
      while (i < lines.length) {
        const closingMatch = lines[i].match(/^ {0,3}(`+|~+)[ \t]*$/);

        if (
          closingMatch &&
          closingMatch[1][0] === fenceChar &&
          closingMatch[1].length >= fenceLength
        ) {
          i++;
          break;
        }

        codeLines.push(lines[i]);
        i++;
      }

      // Preserve the original code content without inline Markdown parsing.
      const code = codeLines.length ? codeLines.join("\n") + "\n" : "";

      output.push(
        '<div class="pk-blog-code-block">' +
          '<button type="button" class="pk-blog-copy-button" data-cms-copy-code aria-label="Copy code" title="Copy code">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<rect x="8" y="8" width="12" height="12" rx="2"></rect>' +
          '<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path>' +
          "</svg>" +
          "</button>" +
          "<pre><code" +
          (language ? ' data-language="' + escapeHtml(language) + '"' : "") +
          ">" +
          escapeHtml(code) +
          "</code></pre>" +
          "</div>",
      );

      continue;
    }

    // Keep the existing heading parser unchanged.
    const headingMatch = line.match(/^(#{1,6})[ \t]+(.+?)\s*#*\s*$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = parseInline(headingMatch[2]);

      const sizes = {
        1: "2em",
        2: "1.5em",
        3: "1.25em",
        4: "1.125em",
      };

      output.push(
        '<div class="pk-blog-heading pk-blog-heading-' +
          level +
          '" style="font-size:' +
          sizes[level] +
          ';font-weight:700;line-height:1.3;margin:0.8em 0 0.4em;">' +
          content +
          "</div>",
      );

      i++;
      continue;
    }

    // Keep existing inline Markdown parsing.
    output.push(parseInline(line));
    i++;
  }

  return output.join("<br>\n");
}
