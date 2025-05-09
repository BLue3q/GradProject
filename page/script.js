const svg = d3.select("#canvas");
const width = 1200;
const height = 800;

svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", 0)
    .attr("markerWidth", 8)
    .attr("markerHeight", 8)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "blue");

const colors = {
    "variable": "orange",
    "assignment": "red",
    "parameter": "purple",
    "function": "green",
    "function_call": "lightblue",
    "pointer": "blue"
};

let scopeYPositions = {};
let currentY = 50;
let allVariables = [];
let currentStep = 0;
let currentView = 'all';
let pointerLinks = [];
let variablePositions = {};

Promise.all([
    d3.json("data.json"),
    d3.json("functions.json")
]).then(([dataArray, functionMap]) => {
    function processNode(node, parentScope = "global") {
        if (node.type === "declaration" && node.declarations) {
            node.declarations.forEach(decl => {
                const variable = {
                    name: decl.name,
                    value: decl.value ?? "N/A",
                    scope: decl.scope ?? parentScope,
                    type: decl.pointer ? "pointer" : "variable"
                };
                if (decl.pointer && decl.points_to?.name) {
                    variable.pointerTarget = decl.points_to.name;
                }
                allVariables.push(variable);
            });
        } else if (node.type === "assignment") {
            allVariables.push({
                name: node.name,
                value: node.value,
                scope: node.scope ?? parentScope,
                type: "assignment"
            });
        } else if (node.type === "function declaration" || node.type === "the standard Main_Function ") {
            scopeYPositions[node.name] = currentY;
            currentY += 100;

            node.params?.forEach(param => {
                allVariables.push({
                    name: param.name,
                    value: "param",
                    scope: node.name,
                    type: "parameter"
                });
            });

            node.body?.forEach(n => processNode(n, node.name));
        } else if (node.type === "function_call") {
            node.body?.forEach(n => processNode(n, node.name));
        }
    }

    dataArray.forEach(node => processNode(node));
    Object.values(functionMap).forEach(fn => processNode(fn));

    Object.keys(scopeYPositions).forEach((key, index) => {
        scopeYPositions[key] = 50 + index * 100;
    });

    updateView();
});

document.getElementById("nextBtn").addEventListener("click", () => {
    if (currentStep < allVariables.length) {
        currentStep++;
        updateView();
    }
});

document.getElementById("backBtn").addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        updateView();
    }
});

function setView(view) {
    currentView = view;
    updateView();
}

function filteredVariables() {
    return allVariables.slice(0, currentStep).filter(isInCurrentView);
}

function isInCurrentView(variable) {
    if (currentView === 'all') return true;
    if (currentView === 'data') return variable.scope === 'global';
    if (currentView === 'stack') return variable.scope !== 'global';
    return true;
}

function updateView() {
    svg.selectAll("*").remove();
    variablePositions = {};
    pointerLinks = [];

    const visibleVars = filteredVariables();

    if (currentView === 'stack') {
        drawStackView(visibleVars);
    } else if (currentView === 'all') {
        drawAllView(visibleVars);
    } else {
        drawNormalView(visibleVars);
    }

    drawPointerArrows();
}

function drawPointerArrows() {
    pointerLinks.forEach(link => {
        const source = variablePositions[link.source];
        const target = variablePositions[link.target];

        if (source && target) {
            svg.append("line")
                .attr("x1", source.x)
                .attr("y1", source.y)
                .attr("x2", target.x)
                .attr("y2", target.y)
                .attr("stroke", "blue")
                .attr("stroke-width", 2)
                .attr("marker-end", "url(#arrow)");
        }
    });
}

function recordPosition(name, x, y) {
    variablePositions[name] = { x, y };
}


function recordPosition(name, x, y) {
    variablePositions[name] = { x, y };
}

function drawStackView(vars) {
    const framePadding = 10;
    const varHeight = 30;
    const stackWidth = 200;
    const startX = width / 2 - stackWidth / 2;
    const startY = height - 50;

    const orderedVars = vars.filter(v => v.scope !== 'global');

    let scopeOrder = [];
    let scopeToVars = {};

    orderedVars.forEach(v => {
        if (!scopeToVars[v.scope]) {
            scopeToVars[v.scope] = [];
            scopeOrder.push(v.scope);
        }
        scopeToVars[v.scope].push(v);
    });

    let currentY = startY;

    scopeOrder.reverse().forEach(scope => {
        const scopeVars = scopeToVars[scope];
        const frameHeight = framePadding * 2 + scopeVars.length * varHeight;

        svg.append("rect")
            .attr("x", startX)
            .attr("y", currentY - frameHeight)
            .attr("width", stackWidth)
            .attr("height", frameHeight)
            .attr("fill", "#f0f0f0")
            .attr("stroke", "#333");

        svg.append("text")
            .attr("x", startX + stackWidth / 2)
            .attr("y", currentY - frameHeight + 15)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text(scope);

        scopeVars.slice().reverse().forEach((v, i) => {
            const varY = currentY - framePadding - i * varHeight;
            const varX = startX + stackWidth / 2;

            svg.append("rect")
                .attr("x", startX + 10)
                .attr("y", varY - varHeight)
                .attr("width", stackWidth - 20)
                .attr("height", varHeight - 5)
                .attr("fill", colors[v.type] || "gray")
                .attr("stroke", "black");

            svg.append("text")
                .attr("x", varX)
                .attr("y", varY - 10)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .text(`${v.name} = ${v.value}`);

            recordPosition(v.name, varX, varY - varHeight / 2);

            if (v.type === "pointer" && v.pointerTarget) {
                pointerLinks.push({ source: v.name, target: v.pointerTarget });
            }
        });

        currentY -= frameHeight + 10;
    });
}

function drawNormalView(filteredVars) {
    svg.selectAll("circle")
        .data(filteredVars)
        .enter()
        .append("circle")
        .attr("cx", (d, i) => {
            const x = 100 + (i % 6) * 120;
            recordPosition(d.name, x, scopeYPositions[d.scope] || 400);
            return x;
        })
        .attr("cy", d => scopeYPositions[d.scope] || 400)
        .attr("r", 30)
        .attr("fill", d => colors[d.type] || "gray")
        .attr("stroke", "black");

    svg.selectAll("text.variable")
        .data(filteredVars)
        .enter()
        .append("text")
        .attr("x", (d, i) => 100 + (i % 6) * 120)
        .attr("y", d => (scopeYPositions[d.scope] || 400) + 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .text(d => d.name)
        .style("fill", "white");

    filteredVars.forEach(d => {
        if (d.type === "pointer" && d.pointerTarget) {
            pointerLinks.push({ source: d.name, target: d.pointerTarget });
        }
    });
}

function drawAllView(filteredVars) {
    const scopeVars = {};
    let yOffset = 50;

    filteredVars.forEach(v => {
        if (!scopeVars[v.scope]) {
            scopeVars[v.scope] = [];
        }
        scopeVars[v.scope].push(v);
    });

    Object.entries(scopeVars).forEach(([scope, vars]) => {
        const bubblesPerRow = 6;
        const bubbleSpacingX = 140;
        const bubbleSpacingY = 60;
        const padding = 30;
        const rows = Math.ceil(vars.length / bubblesPerRow);
        const boxHeight = padding * 2 + rows * bubbleSpacingY;
        const boxWidth = 900;

        scopeYPositions[scope] = yOffset;

        svg.append("rect")
            .attr("x", 30)
            .attr("y", yOffset)
            .attr("width", boxWidth)
            .attr("height", boxHeight)
            .attr("fill", "none")
            .attr("stroke", "black");

        svg.append("text")
            .attr("x", 40)
            .attr("y", yOffset - 10)
            .text(scope)
            .attr("font-size", "14px")
            .attr("fill", "black");

        vars.forEach((v, i) => {
            const col = i % bubblesPerRow;
            const row = Math.floor(i / bubblesPerRow);
            const cx = 80 + col * bubbleSpacingX;
            const cy = yOffset + padding + row * bubbleSpacingY;

            svg.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", 25)
                .attr("fill", colors[v.type] || "gray")
                .attr("stroke", "black");

            svg.append("text")
                .attr("x", cx)
                .attr("y", cy + 5)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("fill", "white")
                .text(v.name);

            recordPosition(v.name, cx, cy);

            if (v.type === "pointer" && v.pointerTarget) {
                pointerLinks.push({ source: v.name, target: v.pointerTarget });
            }
        });

        yOffset += boxHeight + 40;
    });
}
