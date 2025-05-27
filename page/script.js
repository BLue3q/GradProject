let timeline = [];
let step     = 0;

document.getElementById("nextBtn").addEventListener("click", () => {
  if (step < timeline.length) {
    step++;
    render();
  }
});
document.getElementById("backBtn").addEventListener("click", () => {
  if (step > 0) {
    step--;
    render();
  }
});

function visibleVars() {
  const activeScopes = currentStack();
  return timeline
    .slice(0, step)
    .filter(e => e.event === "var" && activeScopes.includes(e.data.scope))
    .map(e => e.data);
}

function currentStack() {
  const stack = [];
  for (let i = 0; i < step; i++) {
    const e = timeline[i];
    if (e.event === "push") stack.push(e.scope);
    if (e.event === "pop")  stack.pop();
  }
  if (!stack.includes("global")) stack.unshift("global");
  return stack;
}

function groupByScope(vars) {
  const byScope = {};
  vars.forEach(v => {
    const s = v.scope || "global";
    if (!byScope[s]) byScope[s] = [];
    byScope[s].push(v);
  });
  return byScope;
}

function render() {
  const vars = visibleVars();
  const stack = currentStack();
  const varsByScope = groupByScope(vars);

  drawMemorySections(vars);
  drawRightFrames(stack, varsByScope);
}

// =======================
// MIDDLE: STACK + HEAP
// =======================

let variablePositions = {}, pointerLinks = [];

function drawMemorySections(vars) {
  const svg = d3.select("#main-svg");
  svg.selectAll("*").remove();
  variablePositions = {};
  pointerLinks = [];

  const width = 1200;
  const pad = 40;
  const sectionWidth = (width - pad * 2) / 2;

  // Shift everything to the right by adding an offset
  const rightOffset = 200;
  const stackX = pad + rightOffset;
  const heapX = pad + sectionWidth + 40 + rightOffset;
  const sectionY = 80; // Increased to move drawings down

  // Section Labels
  svg.append("text").text("Stack")
    .attr("x", stackX).attr("y", sectionY - 10)
    .attr("font-size", "16px").attr("font-weight", "bold");

  svg.append("text").text("Heap")
    .attr("x", heapX).attr("y", sectionY - 10)
    .attr("font-size", "16px").attr("font-weight", "bold");

  // ⛓️ Draw vertical divider line between Stack and Heap
  const dividerX = (stackX + heapX) / 2 - 20;
  svg.append("line")
    .attr("x1", dividerX)
    .attr("y1", 0)
    .attr("x2", dividerX)
    .attr("y2", 1000) // extend long enough vertically
    .attr("stroke", "#aaa")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4");

  // Separate vars
  let stackVars = vars.filter(v => !v.allocation || v.allocation !== "new");
  let heapVars = vars.filter(v => v.allocation === "new");

  // Draw stack variables first
  drawVariables(svg, stackVars, stackX, sectionY, "stack");
  
  // Draw heap variables
  drawVariables(svg, heapVars, heapX, sectionY, "heap");

  // Create pointer links for heap allocations
  stackVars.forEach(v => {
    if (v.type === "pointer" && v.pointsTo) {
      pointerLinks.push({ from: v.name, to: v.pointsTo });
    }
  });

  drawPointerArrows(svg);
}


function drawVariables(svg, vars, baseX, baseY, area) {
  const r = 30;
  const sx = 140, sy = 100;

  vars.forEach((v, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = baseX + col * sx;
    const cy = baseY + row * sy;

    variablePositions[v.name] = { x: cx, y: cy };

    // Handle arrays and heap allocations
    if (v.type === "heap" || (v.array_size && v.array_size > 1)) {
      const cellWidth = 40;
      const cellHeight = 30;
      const length = v.array_size || 1;

      // Draw array container
      svg.append("rect")
        .attr("x", cx - (length * cellWidth) / 2)
        .attr("y", cy - cellHeight / 2)
        .attr("width", length * cellWidth)
        .attr("height", cellHeight)
        .attr("fill", v.type === "heap" ? "#d0f0c0" : "#ffa07a")
        .attr("stroke", "black");

      // Draw cell dividers and values
      for (let j = 0; j < length; j++) {
        const cellX = cx - (length * cellWidth) / 2 + j * cellWidth;
        
        // Draw cell divider
        svg.append("line")
          .attr("x1", cellX)
          .attr("y1", cy - cellHeight / 2)
          .attr("x2", cellX)
          .attr("y2", cy + cellHeight / 2)
          .attr("stroke", "black");

        // Add cell value if available
        const value = v.values && v.values[j] !== undefined ? v.values[j] : "?";
        svg.append("text")
          .attr("x", cellX + cellWidth / 2)
          .attr("y", cy + 5)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .text(value);
      }

      // Add variable name
      svg.append("text")
        .attr("x", cx)
        .attr("y", cy - cellHeight / 2 - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .text(v.name);

    } else {
      // Regular variables (non-array, non-heap)
      const fill = v.type === "pointer" ? "#add8e6" : "#ffa07a";
      svg.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r)
        .attr("fill", fill)
        .attr("stroke", "black");

      // Add variable name and value
      let displayText = v.name;
      if (v.value !== null && v.value !== undefined) {
        displayText += ` = ${v.value}`;
      }
      
      svg.append("text")
        .attr("x", cx)
        .attr("y", cy + 5)
        .attr("text-anchor", "middle")
        .attr("font-family", "monospace")
        .attr("font-size", "14px")
        .text(displayText);

      // Queue pointer arrow if it's a pointer
      if (v.type === "pointer" && v.pointsTo) {
        pointerLinks.push({ from: v.name, to: v.pointsTo });
      }
    }
  });
}

function drawPointerArrows(svg) {
  // Define arrow marker
  svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "blue");

  pointerLinks.forEach(link => {
    const from = variablePositions[link.from];
    const to = variablePositions[link.to];
    if (from && to) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = Math.atan2(dy, dx);
      const offset = 30;

      // Calculate start and end points
      const x1 = from.x + offset * Math.cos(angle);
      const y1 = from.y + offset * Math.sin(angle);
      const x2 = to.x - offset * Math.cos(angle);
      const y2 = to.y - offset * Math.sin(angle);

      // Draw the arrow line
      svg.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)");
    }
  });
}

// ============ RIGHT PANEL =============
function drawRightFrames(stack, varsByScope) {
  const container = document.getElementById("stack-section");
  container.innerHTML = "";

  if (!stack.includes("global")) stack.unshift("global");

  stack.forEach(scope => {
    const frame = document.createElement("div");
    frame.style.border = `2px solid ${scope === "global" ? "green" : "steelblue"}`;
    frame.style.padding = "8px";
    frame.style.marginBottom = "10px";
    frame.style.borderRadius = "8px";
    frame.style.fontFamily = "monospace";
    frame.style.background = "#fdfdfd";

    const title = document.createElement("div");
    title.textContent = `Scope: ${scope}`;
    title.style.color = scope === "global" ? "green" : "steelblue";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "6px";
    frame.appendChild(title);

    const vars = varsByScope[scope] || [];
    vars.forEach(v => {
      if (v.type === "heap") return;
      const line = document.createElement("div");
      let valueDisplay = "";
      if (v.type === "pointer" && v.pointsTo) {
        valueDisplay = ` → ${v.pointsTo}`;
      } else if (v.value != null) {
        valueDisplay = ` = ${v.value}`;
      }
      line.textContent = `${v.type} ${v.name}${valueDisplay}`;
      frame.appendChild(line);
    });

    container.appendChild(frame);
  });
}

// ============ DATA LOADING ============

function loadData() {
  d3.json("data.json").then(data => {
    timeline = [];
    timeline.push({ event: "push", scope: "global" });

    function visit(node, parentScope = "global") {
      if (node.type === "declaration" && node.declarations) {
        node.declarations.forEach(d => {
          const isPointer = d.pointer === true;
          const allocNew = d.allocation === "new";
          const size = d.array_size || 1;

          if (allocNew) {
            // First add the pointer variable to the stack
            timeline.push({
              event: "var",
              data: {
                name: d.name,
                value: d.value ?? null,
                scope: d.scope ?? parentScope,
                type: "pointer",
                pointsTo: d.name + "_heap"
              }
            });

            // Then add the heap allocation
            timeline.push({
              event: "var",
              data: {
                name: d.name + "_heap",
                scope: "heap",
                type: "heap",
                array_size: size,
                values: d.values || Array(size).fill("?"),
                allocation: "new"
              }
            });
          } else {
            // Regular variable (not a heap allocation)
            timeline.push({
              event: "var",
              data: {
                name: d.name,
                value: d.value ?? null,
                scope: d.scope ?? parentScope,
                type: isPointer ? "pointer" : (d.array_size ? "array" : "variable"),
                array_size: d.array_size,
                values: d.values,
                pointsTo: d.points_to?.name ?? null
              }
            });
          }
        });
      } else if (node.type === "assignment") {
        timeline.push({
          event: "var",
          data: {
            name: node.name,
            value: node.value,
            scope: node.scope ?? parentScope,
            type: "assignment"
          }
        });
      } else if (node.type === "function declaration" || node.type === "the standard Main_Function ") {
        if (node.type === "the standard Main_Function ") {
          timeline.push({ event: "push", scope: node.name });
          node.params?.forEach(p => {
            timeline.push({
              event: "var",
              data: {
                name: p.name,
                value: "param",
                scope: node.name,
                type: "parameter"
              }
            });
          });
          node.body?.forEach(n => visit(n, node.name));
          timeline.push({ event: "pop", scope: node.name });
        }
      } else if (node.type === "function_call") {
        timeline.push({ event: "push", scope: node.name });
        node.body?.forEach(n => visit(n, node.name));
        timeline.push({ event: "pop", scope: node.name });
      }
    }

    data.forEach(n => visit(n));
    render();
  });
}

document.addEventListener("DOMContentLoaded", loadData);
