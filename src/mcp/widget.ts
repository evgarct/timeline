export const TIMELINE_WIDGET_URI = "ui://fitness-timeline/result.html";

export const timelineWidgetHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 12px; background: transparent; color: CanvasText; }
    main { border: 1px solid color-mix(in srgb, CanvasText 12%, transparent); border-radius: 16px; padding: 14px; background: color-mix(in srgb, Canvas 96%, transparent); }
    h1 { margin: 0 0 6px; font-size: 15px; }
    p { margin: 0; color: color-mix(in srgb, CanvasText 64%, transparent); }
    code#entity-id { display: none; font-size: 11px; color: color-mix(in srgb, CanvasText 50%, transparent); }
    code#entity-id.visible { display: inline-block; margin-top: 4px; }
    ul { display: grid; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
    li { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent); padding-top: 8px; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Fitness Timeline</h1>
    <p id="summary">Timeline updated.</p>
    <code id="entity-id"></code>
    <ul id="items"></ul>
  </main>
  <script type="module">
    import { App } from "https://esm.sh/@modelcontextprotocol/ext-apps@1";
    const app = new App({ name: "Fitness Timeline", version: "0.1.0" });
    app.ontoolresult = (result) => {
      const data = result.structuredContent ?? {};
      document.querySelector("#title").textContent = data.title ?? "Fitness Timeline";
      document.querySelector("#summary").textContent = data.summary ?? "Timeline updated.";
      const idEl = document.querySelector("#entity-id");
      idEl.textContent = data.id ? \`id: \${data.id}\` : "";
      idEl.title = data.id ?? "";
      idEl.classList.toggle("visible", Boolean(data.id));
      const list = document.querySelector("#items");
      list.replaceChildren(...(data.items ?? []).slice(0, 6).map((item) => {
        const row = document.createElement("li");
        row.innerHTML = "<span></span><strong></strong>";
        row.children[0].textContent = item.label ?? "";
        row.children[1].textContent = item.value ?? "";
        return row;
      }));
    };
    await app.connect();
  </script>
</body>
</html>`;

