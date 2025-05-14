// === Timeline of events: {event: 'push'|'pop'|'var', scope?, data?} ===
let timeline = [];
let step      = 0;

// Controls
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

// Render both middle & right based on timeline[0..step)
function render() {
  // 1) Build frame stack
  const frameStack = [];
  for (let i = 0; i < step; i++) {
    const e = timeline[i];
    if (e.event === "push") frameStack.push(e.scope);
    if (e.event === "pop")  frameStack.pop();
  }

  // 2) Gather all 'var' events up to step
  const visibleVars = timeline
    .slice(0, step)
    .filter(e => e.event === "var")
    .map(e => e.data);

  drawMiddleView(visibleVars);
  drawRightFrames(frameStack);
}

// ——————————————————————————————
// MIDDLE: circles + arrows
// ——————————————————————————————

let variablePositions = {}, pointerLinks = [];

function drawMiddleView(vars) {
  const svg = d3.select("#main-svg");
  svg.selectAll("*").remove();
  variablePositions = {};
  pointerLinks      = [];

  const pad   = 40, r = 30, perRow = 4, sx = 140, sy = 100;

  vars.forEach((v, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const cx  = pad + col * sx, cy = pad + row * sy;

    // Circle
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", r)
      .attr("fill", v.type === "pointer" ? "#add8e6" : "#ffa07a")
      .attr("stroke", "black");

    // Name
    svg.append("text")
      .attr("x", cx).attr("y", cy+5)
      .attr("text-anchor","middle")
      .attr("font-family","monospace")
      .attr("font-size","14px")
      .text(v.name);

    variablePositions[v.name] = {x:cx, y:cy};

    // Queue arrow
    if (v.type==="pointer" && v.pointsTo) {
      pointerLinks.push({from:v.name, to:v.pointsTo});
    }
  });

  drawPointerArrows(svg);
}

function drawPointerArrows(svg) {
  // Arrowhead
  svg.append("defs").append("marker")
    .attr("id","arrowhead")
    .attr("viewBox","0 -5 10 10")
    .attr("refX",10).attr("refY",0)
    .attr("markerWidth",6).attr("markerHeight",6)
    .attr("orient","auto")
    .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","blue");

  // Lines
  pointerLinks.forEach(link => {
    const s=variablePositions[link.from], t=variablePositions[link.to];
    if(s&&t&&s!==t){
      svg.append("line")
        .attr("x1",s.x).attr("y1",s.y)
        .attr("x2",t.x).attr("y2",t.y)
        .attr("stroke","blue")
        .attr("stroke-width",2)
        .attr("marker-end","url(#arrowhead)");
    }
  });
}

// ——————————————————————————————
// RIGHT: call stack frames
// ——————————————————————————————

function drawRightFrames(stack) {
  const c = document.getElementById("stack-section");
  c.innerHTML = "";
  stack.forEach(scope => {
    const f = document.createElement("div");
    f.style.border = `2px solid ${scope==="global"?"green":"steelblue"}`;
    f.style.borderRadius="8px";
    f.style.padding="8px";
    f.style.marginBottom="12px";
    f.style.background="#fdfdfd";
    f.style.fontFamily="monospace";
    f.style.boxShadow="0 1px 4px rgba(0,0,0,0.1)";

    const title = document.createElement("div");
    title.textContent = "Scope: "+scope;
    title.style.fontWeight="bold";
    title.style.marginBottom="6px";
    title.style.color = scope==="global"?"green":"steelblue";
    f.appendChild(title);

    c.appendChild(f);
  });
}

// ——————————————————————————————
// DATA → timeline
// ——————————————————————————————

function loadData() {
  d3.json("data.json").then(data => {
    buildTimeline(data);
    render();
  });
}

function buildTimeline(data) {
  timeline = [];
  // 1) push global
  timeline.push({event:"push", scope:"global"});

  function visit(node, parentScope="global") {
    // Declaration
    if(node.type==="declaration" && node.declarations){
      node.declarations.forEach(d=>{
        // var event
        timeline.push({
          event:"var",
          data:{
            name: d.name,
            value:d.value ?? null,
            scope:d.scope ?? parentScope,
            type: d.pointer?"pointer":"variable",
            pointsTo: (d.pointer&&d.points_to?.name)?d.points_to.name:null
          }
        });
      });
    }
    // Assignment
    else if(node.type==="assignment"){
      timeline.push({
        event:"var",
        data:{
          name:node.name,
          value:node.value,
          scope:node.scope||parentScope,
          type:"assignment",
          pointsTo:null
        }
      });
    }
    // Main / function declaration => treat as push/pop
    else if(
      node.type==="function declaration" ||
      node.type==="the standard Main_Function "
    ){
      timeline.push({event:"push",scope:node.name});
      node.params?.forEach(p=>{
        timeline.push({
          event:"var",
          data:{
            name:p.name,
            value:"param",
            scope:node.name,
            type:"parameter",
            pointsTo:null
          }
        });
      });
      node.body?.forEach(ch=>visit(ch,node.name));
      timeline.push({event:"pop",scope:node.name});
    }
    // Function call: push/pop around its body
    else if(node.type==="function_call"){
      timeline.push({event:"push", scope:node.name});
      node.body?.forEach(ch=>visit(ch,node.name));
      timeline.push({event:"pop", scope:node.name});
    }
    // Class declaration: just its members as vars
    else if(node.type==="class declaration"){
      node.members?.forEach(m=>{
        timeline.push({
          event:"var",
          data:{
            name:m.name,
            value:null,
            scope:node.name,
            type:m.pointer?"pointer":"variable",
            pointsTo:null
          }
        });
      });
    }
  }

  data.forEach(n=>visit(n));
  // Finally pop global at very end if you like (optional)
  // timeline.push({event:"pop",scope:"global"});
}

document.addEventListener("DOMContentLoaded", loadData);
