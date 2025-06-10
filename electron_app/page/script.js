let timeline = [];
let step = 0;

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
  const vars = [];
  const varMap = new Map(); // Track variables by scope.name

  // Process timeline up to current step
  for (let i = 0; i < step; i++) {
    const e = timeline[i];
    if (
      e.event === "var" &&
      (
        activeScopes.some(scope =>
          e.data.scope === scope || e.data.scope === `function:${scope}`
        ) ||
        e.data.scope === "heap"
      )
    ) {
      const key = `${e.data.scope}.${e.data.name}`;
      // Always update the variable with the value at this step
      varMap.set(key, {...e.data});
    }
  }

  // Convert map values to array
  return Array.from(varMap.values());
}


function currentStack() {
  const stack = [];
  for (let i = 0; i < step; i++) {
    const e = timeline[i];
    if (e.event === "push") stack.push(e.scope);
    if (e.event === "pop") stack.pop();
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

  // Update line section with current line
  const currentEvent = timeline[step - 1];
  const lineSection = document.querySelector("#line-section pre");
  if (currentEvent && currentEvent.data && currentEvent.data.line) {
    lineSection.textContent = `Line ${currentEvent.data.line}`;
  } else if (currentEvent && currentEvent.event === "push") {
    lineSection.textContent = `Entering scope: ${currentEvent.scope}`;
  } else if (currentEvent && currentEvent.event === "pop") {
    lineSection.textContent = `Exiting scope: ${currentEvent.scope}`;
  } else {
    lineSection.textContent = "No line information available";
  }

  drawMemorySections(vars);
  drawRightFrames(stack, varsByScope);
}

let variablePositions = {}, pointerLinks = [];

function drawMemorySections(vars) {
  const svg = d3.select("#main-svg");
  svg.selectAll("*").remove();
  variablePositions = {};
  pointerLinks = [];

  // Create tooltip div
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("padding", "8px")
    .style("font-family", "monospace")
    .style("font-size", "12px")
    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
    .style("z-index", "1000");

  const width = 2000;
  const pad = 40;
  const sectionWidth = (width - pad * 2) / 2;

  const rightOffset = 200;
  const stackX = pad + rightOffset;
  const heapX = pad + sectionWidth + 40 + rightOffset;
  const sectionY = 80;

  const dividerX = (stackX + heapX) / 2 - 20;
  svg.append("line")
    .attr("x1", dividerX)
    .attr("y1", 0)
    .attr("x2", dividerX)
    .attr("y2", 2000)
    .attr("stroke", "#aaa")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4");

  // Separate heap variables by allocation type
  const stackVars = vars.filter(v => v.scope !== "heap");
  const heapVars = vars.filter(v => v.scope === "heap");
  
  // Sort heap variables to group new allocations together
  heapVars.sort((a, b) => {
    if (a.allocation === "new" && b.allocation !== "new") return -1;
    if (a.allocation !== "new" && b.allocation === "new") return 1;
    return 0;
  });

  drawVariables(svg, stackVars, stackX, sectionY, "stack", tooltip);
  drawVariables(svg, heapVars, heapX, sectionY, "heap", tooltip);

  drawPointerArrows(svg);
}

function drawVariables(svg, vars, baseX, baseY, area, tooltip) {
  const r = 30;
  const sx = 180;
  const sy = 140;
  let currentRow = 0;
  let currentCol = 0;

  // Function to create tooltip content
  function createTooltipContent(v) {
    let content = `<strong>Name:</strong> ${v.name}<br>`;
    content += `<strong>Type:</strong> ${v.type}<br>`;
    content += `<strong>Scope:</strong> ${v.scope}<br>`;
    if (v.line !== undefined) {
      content += `<strong>Line:</strong> ${v.line}<br>`;
    }
    if (v.id !== undefined) {
      content += `<strong>ID:</strong> ${v.id}<br>`;
    }
    if (v.value !== undefined && v.value !== null) {
      content += `<strong>Value:</strong> ${typeof v.value === 'object' ? v.value.value || 'null' : v.value}<br>`;
    }
    if (v.pointsTo) {
      content += `<strong>Points to:</strong> ${v.pointsTo}<br>`;
    }
    if (v.array_size) {
      content += `<strong>Array size:</strong> ${v.array_size}<br>`;
    }
    if (v.dimensions) {
      content += `<strong>Dimensions:</strong> ${v.dimensions.join(' x ')}<br>`;
    }
    if (v.values) {
      content += `<strong>Values:</strong> ${v.values.join(', ')}<br>`;
    }
    return content;
  }

  // Function to wrap text
  function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = getTextWidth(currentLine + " " + word);
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // Function to get text width
  function getTextWidth(text) {
    const temp = svg.append("text")
      .attr("font-family", "monospace")
      .attr("font-size", "13px")
      .text(text);
    const width = temp.node().getBBox().width;
    temp.remove();
    return width;
  }

  // First pass: Draw all non-member variables
  vars.forEach((v, i) => {
    if (v.name.includes(".")) return; // Skip member variables for now

    // Calculate position based on area and allocation type
    let cx, cy;
    if (area === "heap") {
      if (v.allocation === "new") {
        cx = baseX + currentCol * (sx * 1.5);
        cy = baseY + currentRow * (sy * 1.5);
        currentCol++;
        if (currentCol >= 2) {
          currentCol = 0;
          currentRow++;
        }
      } else {
        cx = baseX + (i % 2) * sx;
        cy = baseY + Math.floor(i / 2) * sy;
      }
    } else {
      cx = baseX + (i % 2) * sx;
      cy = baseY + Math.floor(i / 2) * sy;
    }

    variablePositions[v.name] = { x: cx, y: cy };

    // Draw the variable based on its type
    if (v.type === "heap" || v.type === "array") {
      const cellWidth = 40;
      const cellHeight = 30;
      const length = v.array_size || (v.dimensions ? v.dimensions[0] : 1);

      const container = svg.append("g")
        .attr("class", "variable-container");

      container.append("rect")
        .attr("x", cx - (length * cellWidth) / 2)
        .attr("y", cy - cellHeight / 2)
        .attr("width", length * cellWidth)
        .attr("height", cellHeight)
        .attr("fill", v.type === "heap" ? "#d0f0c0" : "#f5deb3")
        .attr("stroke", "black")
        .on("mouseover", function(event) {
          tooltip.style("visibility", "visible")
            .html(createTooltipContent(v))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
        });

      for (let j = 0; j < length; j++) {
        const cellX = cx - (length * cellWidth) / 2 + j * cellWidth;
        svg.append("line")
          .attr("x1", cellX)
          .attr("y1", cy - cellHeight / 2)
          .attr("x2", cellX)
          .attr("y2", cy + cellHeight / 2)
          .attr("stroke", "black");

        const value = v.values && v.values[j] !== undefined ? v.values[j] : "?";
        svg.append("text")
          .attr("x", cellX + cellWidth / 2)
          .attr("y", cy + 5)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .text(value);
      }

      svg.append("text")
        .attr("x", cx)
        .attr("y", cy - cellHeight / 2 - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .text(v.name);
    }
    else if (v.type === "pointer") {
      const size = 40;
      const container = svg.append("g")
        .attr("class", "variable-container");

      container.append("polygon")
        .attr("points", `${cx},${cy - size / 2} ${cx + size / 2},${cy} ${cx},${cy + size / 2} ${cx - size / 2},${cy}`)
        .attr("fill", "#add8e6")
        .attr("stroke", "black")
        .on("mouseover", function(event) {
          tooltip.style("visibility", "visible")
            .html(createTooltipContent(v))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
        });

      const textLines = wrapText(v.name, size * 0.8);
      textLines.forEach((line, i) => {
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - (textLines.length - 1) * 6 + i * 12)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", "12px")
          .text(line);
      });

      if (v.pointsTo) {
        pointerLinks.push({ from: v.name, to: v.pointsTo });
      }
    }
    else if (v.type === "parameter") {
      const size = 30;
      const container = svg.append("g")
        .attr("class", "variable-container");

      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = Math.PI / 3 * i;
        return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
      }).join(" ");

      container.append("polygon")
        .attr("points", points)
        .attr("fill", "#90ee90")
        .attr("stroke", "black")
        .on("mouseover", function(event) {
          tooltip.style("visibility", "visible")
            .html(createTooltipContent(v))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
        });

      const textLines = wrapText(v.name, size * 1.5);
      textLines.forEach((line, i) => {
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - (textLines.length - 1) * 6 + i * 12)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", "12px")
          .text(line);
      });
    }
    else if (v.type === "object") {
      const objectName = v.name;
      const className = v.value;

      // Get all member variables associated with this object
      const members = vars.filter(mem => mem.name.startsWith(objectName + "."));

      // Size and layout
      const padding = 10;
      const lineHeight = 26;
      const boxWidth = 200;
      const headerHeight = 30;
      const boxHeight = headerHeight + members.length * lineHeight + padding * 2;

      // Draw object container
      svg.append("rect")
        .attr("x", cx - boxWidth / 2)
        .attr("y", cy - boxHeight / 2)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("fill", area === "heap" ? "#d0f0c0" : "#f0f8ff")
        .attr("stroke", "black")
        .attr("stroke-width", 2);

      // Object name as title
      svg.append("text")
        .attr("x", cx)
        .attr("y", cy - boxHeight / 2 + headerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("font-family", "monospace")
        .text(objectName);

      // Divider
      svg.append("line")
        .attr("x1", cx - boxWidth / 2)
        .attr("y1", cy - boxHeight / 2 + headerHeight)
        .attr("x2", cx + boxWidth / 2)
        .attr("y2", cy - boxHeight / 2 + headerHeight)
        .attr("stroke", "black");

      // Draw member variables
      members.forEach((mem, idx) => {
        const memberY = cy - boxHeight / 2 + headerHeight + padding + idx * lineHeight;
        const memberX = cx - boxWidth / 2 + padding;

        // Position of this member (center)
        const memCx = memberX + 80;
        const memCy = memberY - 5;

        // Track position for pointer arrows
        variablePositions[mem.name] = { x: memCx, y: memCy };

        // Draw circle or rhombus depending on type
        if (mem.type === "pointer") {
          // Rhombus for pointer
          svg.append("polygon")
            .attr("points", `
              ${memCx},${memCy - 10}
              ${memCx + 10},${memCy}
              ${memCx},${memCy + 10}
              ${memCx - 10},${memCy}
            `)
            .attr("fill", "#add8e6")
            .attr("stroke", "black");

          // Label
          svg.append("text")
            .attr("x", memCx)
            .attr("y", memCy + 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-family", "monospace")
            .text(mem.name.split(".")[1]);

          // Add to pointerLinks if it points to something
          if (mem.pointsTo) {
            pointerLinks.push({ from: mem.name, to: mem.pointsTo });
          }
        } else {
          // Circle for regular member variable
          svg.append("circle")
            .attr("cx", memCx)
            .attr("cy", memCy)
            .attr("r", 10)
            .attr("fill", "#ffa07a")
            .attr("stroke", "black");

          let displayText = mem.name.split(".")[1];
          if (mem.value !== undefined && mem.value !== null) {
            displayText += `=${mem.value}`;
          }

          svg.append("text")
            .attr("x", memCx)
            .attr("y", memCy + 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-family", "monospace")
            .text(displayText);
        }
      });

      // Track the whole object position
      variablePositions[v.name] = { x: cx, y: cy };
    }
    else {
      const container = svg.append("g")
        .attr("class", "variable-container");

      container.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r)
        .attr("fill", "#ffa07a")
        .attr("stroke", "black")
        .on("mouseover", function(event) {
          tooltip.style("visibility", "visible")
            .html(createTooltipContent(v))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("visibility", "hidden");
        });

      const textLines = wrapText(v.name, r * 1.8);
      textLines.forEach((line, i) => {
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - (textLines.length - 1) * 6 + i * 12)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", "12px")
          .text(line);
      });
    }
  });

  // Second pass: Draw any remaining member variables that weren't part of an object
  vars.forEach((v) => {
    if (v.name.includes(".")) {
      const [objName, memberName] = v.name.split(".");
      // If we haven't drawn this member yet (it wasn't part of an object), draw it separately
      if (!variablePositions[v.name]) {
        const memberX = baseX + 40;
        const memberY = baseY + currentRow * sy;
        currentRow++;
        
        variablePositions[v.name] = { x: memberX, y: memberY };
        
        // Draw the member variable
        if (v.type === "pointer") {
          // Draw rhombus for pointer
          svg.append("polygon")
            .attr("points", `
              ${memberX},${memberY - 10}
              ${memberX + 10},${memberY}
              ${memberX},${memberY + 10}
              ${memberX - 10},${memberY}
            `)
            .attr("fill", "#add8e6")
            .attr("stroke", "black");

          if (v.pointsTo) {
            pointerLinks.push({ from: v.name, to: v.pointsTo });
          }
        } else {
          // Draw circle for regular variable
          svg.append("circle")
            .attr("cx", memberX)
            .attr("cy", memberY)
            .attr("r", 10)
            .attr("fill", "#ffa07a")
            .attr("stroke", "black");
        }

        // Add label
        let displayText = memberName;
        if (v.value !== undefined && v.value !== null) {
          displayText += `=${v.value}`;
        }

        svg.append("text")
          .attr("x", memberX)
          .attr("y", memberY + 4)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-family", "monospace")
          .text(displayText);
      }
    }
  });
}


function drawPointerArrows(svg) {
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
    let from = variablePositions[link.from];
    let to = variablePositions[link.to];

    // 🔁 Try resolving target inside object
    if (!to && link.from.includes(".")) {
      const objName = link.from.split(".")[0];
      const altName = `${objName}.${link.to}`;
      to = variablePositions[altName];
    }

    if (from && to) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;

      const norm = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / norm;
      const perpY = dx / norm;

      const curveAmount = Math.min(80, dist / 3);
      const controlX = mx + perpX * curveAmount;
      const controlY = my + perpY * curveAmount;

      const path = d3.path();
      path.moveTo(from.x, from.y);
      path.quadraticCurveTo(controlX, controlY, to.x, to.y);

      svg.append("path")
        .attr("d", path.toString())
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("marker-end", "url(#arrowhead)");

      // Look up the target ID from timeline
      let targetId = null;
      for (let i = 0; i < step; i++) {
        const e = timeline[i];
        if (
          e.event === "var" &&
          (e.data.name === link.to ||
           (link.from.includes(".") && `${link.from.split(".")[0]}.${link.to}` === e.data.name))
        ) {
          targetId = e.data.id;
          break;
        }
      }

      if (targetId) {
        const idX = mx + perpX * (curveAmount * 0.5);
        const idY = my + perpY * (curveAmount * 0.5);

        svg.append("circle")
          .attr("cx", idX)
          .attr("cy", idY)
          .attr("r", 12)
          .attr("fill", "white")
          .attr("stroke", "blue")
          .attr("stroke-width", 1);

        svg.append("text")
          .attr("x", idX)
          .attr("y", idY)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("fill", "blue")
          .text(targetId);
      }
    }
  });
}



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

function loadData() {
  d3.json("../backend/output.json").then(data => {
    timeline = [];
    timeline.push({ event: "push", scope: "global" });

    function visit(node, parentScope = "global") {
      // Handle class declarations
      if (node.type === "class_declaration") {
        // Process member variables
        node.members.forEach(member => {
          if (member.type === "member_variable") {
            timeline.push({
              event: "var",
              data: {
                name: member.name,
                value: member.default_value,
                scope: member.scope,
                type: member.pointer ? "pointer" : "variable",
                pointsTo: member.points_to?.name ?? null,
                id: member.id,
                line: member.line
              }
            });
          }
        });
      }
      // Handle declarations
      else if (node.type === "declaration") {
        node.declarations.forEach(d => {
          const isPointer = d.pointer === true || 
                          d.pointer === "pointer declaration" || 
                          d.pointer === "array pointer declaration";
          
          // Handle new allocations
          if (d.allocation === "new") {
            timeline.push({
              event: "var",
              data: {
                name: d.name,
                value: d.value ?? null,
                scope: d.scope ?? parentScope,
                type: "pointer",
                pointsTo: d.name + "_heap",
                id: d.id,
                line: d.line
              }
            });

            timeline.push({
              event: "var",
              data: {
                name: d.name + "_heap",
                scope: "heap",
                type: "heap",
                array_size: d.array_size,
                values: d.values || Array(d.array_size).fill("?"),
                allocation: "new",
                id: d.id,
                line: d.line
              }
            });
          } 
          // Handle regular variables and arrays
          else {
            timeline.push({
              event: "var",
              data: {
                name: d.name,
                value: d.value ?? null,
                scope: d.scope ?? parentScope,
                type: isPointer ? "pointer" : 
                      (d.dimensions || d.array_size ? "array" : "variable"),
                array_size: d.array_size,
                dimensions: d.dimensions,
                values: d.values,
                pointsTo: d.points_to?.name ?? null,
                id: d.id,
                line: d.line
              }
            });
          }
        });
      }
      // Handle assignments
      else if (node.type === "assignment") {
        timeline.push({
          event: "var",
          data: {
            name: node.name,
            value: node.value,
            scope: node.scope ?? parentScope,
            type: "assignment",
            id: node.id,
            line: node.line
          }
        });
      }
      // Handle function declarations
      else if (node.type === "function declaration" || node.type === "the standard Main_Function ") {
        // Only process main function body immediately
        if (node.type === "the standard Main_Function ") {
          timeline.push({ event: "push", scope: node.name, line: node.line });
          
          // Add parameters
          node.params?.forEach(p => {
            timeline.push({
              event: "var",
              data: {
                name: p.name,
                value: "param",
                scope: node.name,
                type: "parameter",
                id: p.id,
                line: p.line || node.line
              }
            });
          });

          // Process function body
          node.body?.forEach(n => visit(n, node.name));
          timeline.push({ event: "pop", scope: node.name, line: node.line });
        }
      }
      // Handle function calls
      else if (node.type === "function_call") {
        timeline.push({ event: "push", scope: node.name, line: node.line });

        const funcDef = data.find(n =>
          (n.type === "function declaration" || n.type === "the standard Main_Function ") &&
          n.name === node.name
        );

        if (funcDef) {
          // Add parameters with their resolved argument values
          if (funcDef.params) {
            funcDef.params.forEach((p, index) => {
              const arg = node.arg_param_map?.[index]?.arg_value;
              let argValue;
              
              // If argument is a variable reference, find its current value
              if (arg && arg.name) {
                // Search through timeline to find the most recent value of this variable
                for (let i = timeline.length - 1; i >= 0; i--) {
                  const e = timeline[i];
                  if (e.event === "var" && e.data.name === arg.name) {
                    argValue = e.data.value;
                    break;
                  }
                }
              } else {
                argValue = arg; // Direct value
              }

              timeline.push({
                event: "var",
                data: {
                  name: p.name,
                  value: argValue || "param",
                  scope: node.name,
                  type: "parameter",
                  id: p.id,
                  line: p.line || node.line
                }
              });
            });
          }

          // Process function body
          if (node.body) {
            node.body.forEach(n => visit(n, node.name));
          }
        }

        timeline.push({ event: "pop", scope: node.name, line: node.line });
      }
      // Handle object declarations
      else if (node.type === "object_declaration") {
        timeline.push({
          event: "var",
          data: {
            name: node.name,
            value: node.class_type,
            scope: node.scope,
            type: "object",
            id: node.id,
            line: node.line
          }
        });

        const classDef = data.find(n =>
          n.type === "class_declaration" &&
          n.name === node.class_type
        );

        if (classDef) {
          // First add all member variables with their default values
          classDef.members.forEach(member => {
            if (member.type === "member_variable") {
              timeline.push({
                event: "var",
                data: {
                  name: `${node.name}.${member.name}`,
                  value: member.default_value,
                  scope: node.scope,
                  type: member.pointer ? "pointer" : "variable",
                  pointsTo: member.points_to?.name ?? null,
                  id: member.id,
                  line: member.line || node.line
                }
              });
            }
          });

          // Then process constructor assignments
          const constructor = classDef.members.find(m => m.type === "constructor");
          if (constructor) {
            constructor.body.forEach(assignment => {
              timeline.push({
                event: "var",
                data: {
                  name: `${node.name}.${assignment.name}`,
                  value: assignment.value,
                  scope: node.scope,
                  type: "variable",
                  id: assignment.id,
                  line: assignment.line || constructor.line || node.line
                }
              });
            });
          }
        }
      }
      // Handle method calls
      else if (node.type === "method_call") {
        const objectName = node.object.name;
        const methodName = node.method;
        const scope = `${objectName}.${methodName}`;
        
        timeline.push({ event: "push", scope: scope, line: node.line });

        // Find the class definition
        const classDef = data.find(n =>
          n.type === "class_declaration" &&
          n.name === node.object.class_type
        );

        if (classDef) {
          // Find the method definition
          const methodDef = classDef.members.find(m =>
            m.type === "member_function" &&
            m.name === methodName
          );

          if (methodDef) {
            // Add parameters with their resolved argument values
            if (methodDef.params) {
              methodDef.params.forEach((p, index) => {
                const arg = node.arg_param_map?.[index]?.arg_value;
                timeline.push({
                  event: "var",
                  data: {
                    name: p.name,
                    value: arg,
                    scope: scope,
                    type: "parameter",
                    id: p.id,
                    line: p.line || node.line
                  }
                });
              });
            }

            // Process method body
            if (methodDef.body) {
              methodDef.body.forEach(n => visit(n, scope));
            }
          }
        }

        timeline.push({ event: "pop", scope: scope, line: node.line });
      }
      // Handle member assignments
      else if (node.type === "member_assignment") {
        timeline.push({
          event: "var",
          data: {
            name: `${node.object}.${node.member}`,
            value: node.value,
            scope: node.scope,
            type: "variable",
            line: node.line
          }
        });
      }
  else if (node.type === "class_pointer_declaration" && node.allocation === "new") {
  const pointerName = node.name;
  const heapName = pointerName + "_heap";
  const classType = node.allocated_type || node.class_type;

  // 1. Add the pointer in stack
  timeline.push({
    event: "var",
    data: {
      name: pointerName,
      scope: node.scope,
      type: "pointer",
      value: null,
      pointsTo: heapName
    }
  });

  // 2. Add the object in heap
  timeline.push({
    event: "var",
    data: {
      name: heapName,
      scope: "heap",
      type: "object",
      value: classType
    }
  });

  // 3. Find the class definition for member attributes
  const classDef = data.find(d => d.type === "class_declaration" && d.name === classType);

  if (classDef) {
    classDef.members.forEach(member => {
      if (member.type !== "member_variable") return;

      const isPointer = member.pointer || (member.data_type && member.data_type.includes("*"));
      const memberName = `${heapName}.${member.name}`;

      timeline.push({
        event: "var",
        data: {
          name: memberName,
          scope: "heap",
          type: isPointer ? "pointer" : "variable",
          value: member.default_value ?? null,
          pointsTo: member.points_to?.name ?? null
        }
      });
    });
  }
}


    }

    // Process all nodes
    data.forEach(n => visit(n));
    render();
  });
}

document.addEventListener("DOMContentLoaded", loadData);