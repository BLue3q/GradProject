// Enhanced C++ Visualization Script with D3.js
// Compatible with Electron React environment

console.log("🎯 script.js EXECUTED from:", window.location.href);
console.log("📁 script.js file path: /home/mousa/coding/GradProject/electron_app/public/script.js");
console.log("⚡ script.js execution context:", {
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
  documentReady: document.readyState,
  windowLoaded: document.readyState === 'complete'
});

(function() {
  'use strict';

  // Global variables
  let timeline = [];
  let step = 0;
  let variablePositions = {};
  let pointerLinks = [];

  // Test function for immediate visualization
  window.testDraw = function() {
    console.log('🧪 Running test visualization...');
    
    const svg = d3.select("#main-svg");
    if (!svg.node()) {
      console.error('❌ SVG element #main-svg not found');
      return;
    }

    svg.selectAll("*").remove();
    
    // Draw test circle
    svg.append("circle")
      .attr("cx", 150)
      .attr("cy", 100)
      .attr("r", 40)
      .attr("fill", "steelblue")
      .attr("stroke", "white")
      .attr("stroke-width", 2);

    // Add test text
    svg.append("text")
      .attr("x", 150)
      .attr("y", 105)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", "14px")
      .text("D3.js Working!");

    // Add a test rectangle
    svg.append("rect")
      .attr("x", 50)
      .attr("y", 200)
      .attr("width", 200)
      .attr("height", 60)
      .attr("fill", "#28a745")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("rx", 5);

    svg.append("text")
      .attr("x", 150)
      .attr("y", 235)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", "16px")
      .text("Test Visualization");

    console.log('✅ Test visualization complete');
  };

  // Enhanced render function with fallback
  window.renderVisualization = function(data) {
    console.log('🎨 Rendering visualization with data:', data);
    console.log('📊 Data type:', typeof data, 'Is Array:', Array.isArray(data));
    
    if (!window.d3) {
      console.error('❌ D3.js not available');
      return;
    }

    const svg = d3.select("#main-svg");
    if (!svg.node()) {
      console.error('❌ SVG element #main-svg not found');
      console.log('🔍 Available elements with id containing "svg":', 
        Array.from(document.querySelectorAll('[id*="svg"]')).map(el => el.id)
      );
      return;
    }

    console.log('✅ SVG element found, dimensions:', {
      width: svg.attr('width'),
      height: svg.attr('height'),
      viewBox: svg.attr('viewBox'),
      clientWidth: svg.node()?.clientWidth,
      clientHeight: svg.node()?.clientHeight
    });

    svg.selectAll("*").remove();

    if (!data || (Array.isArray(data) && data.length === 0)) {
      // No data - show placeholder
      console.log('📝 No data provided, showing placeholder');
      svg.append("text")
        .attr("x", 300)
        .attr("y", 200)
        .attr("text-anchor", "middle")
        .attr("fill", "#858585")
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "18px")
        .text("No visualization data available");
      return;
    }

    // Process the data and render
    console.log('🔄 Processing timeline data...');
    processTimelineData(data);
    console.log('🎨 Rendering visualization...');
    render();
    console.log('✅ Visualization rendering complete');
  };

  // Test visualization bounds function
  window.testVisualizationBounds = function() {
    console.log('🧪 Testing visualization bounds...');
    
    const svg = d3.select("#main-svg");
    if (!svg.node()) {
      console.error('❌ SVG not found for bounds test');
      return;
    }
    
    const container = document.getElementById('visualization-main');
    if (!container) {
      console.error('❌ Container not found for bounds test');
      return;
    }
    
    console.log('📐 Container bounds:', {
      width: container.clientWidth,
      height: container.clientHeight,
      scrollWidth: container.scrollWidth,
      scrollHeight: container.scrollHeight
    });
    
    console.log('📏 SVG bounds:', {
      width: svg.attr('width'),
      height: svg.attr('height'),
      viewBox: svg.attr('viewBox'),
      node: svg.node()?.getBoundingClientRect()
    });
    
    // Clear and draw test elements at various positions
    svg.selectAll("*").remove();
    
    // Test elements at different positions
    const testPositions = [
      { x: 100, y: 100, label: 'Top-Left' },
      { x: 600, y: 100, label: 'Top-Center' },
      { x: 1100, y: 100, label: 'Top-Right' },
      { x: 100, y: 300, label: 'Middle-Left' },
      { x: 600, y: 300, label: 'Center' },
      { x: 1100, y: 300, label: 'Middle-Right' },
      { x: 100, y: 500, label: 'Bottom-Left' },
      { x: 600, y: 500, label: 'Bottom-Center' },
      { x: 1100, y: 500, label: 'Bottom-Right' }
    ];
    
    testPositions.forEach((pos, i) => {
      const color = i % 2 === 0 ? '#28a745' : '#007acc';
      
      // Draw circle
      svg.append("circle")
        .attr("cx", pos.x)
        .attr("cy", pos.y)
        .attr("r", 20)
        .attr("fill", color)
        .attr("stroke", "white")
        .attr("stroke-width", 2);
      
      // Add label
      svg.append("text")
        .attr("x", pos.x)
        .attr("y", pos.y + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .text(pos.label);
      
      console.log(`✅ Placed test element at (${pos.x}, ${pos.y}) - ${pos.label}`);
    });
    
    console.log('🎯 Bounds test complete - check if all elements are visible');
  };

  // Process timeline data from analysis
  function processTimelineData(data) {
    timeline = [];
    timeline.push({ event: "push", scope: "global" });

    console.log('📊 Processing timeline data:', data);

    // Handle different data formats
    if (Array.isArray(data)) {
      // Array of nodes - direct processing
      data.forEach(node => visit(node, "global"));
    } else if (data && data.ast && Array.isArray(data.ast)) {
      // Analysis data with AST
      console.log('🔍 Processing AST data:', data.ast);
      data.ast.forEach(node => visit(node, "global"));
    } else if (data && data.analysis && data.analysis.ast) {
      // Wrapped analysis data
      console.log('🔍 Processing wrapped AST data:', data.analysis.ast);
      data.analysis.ast.forEach(node => visit(node, "global"));
    } else if (data && data.blocks) {
      // Block-based data
      console.log('🔍 Processing blocks data:', data.blocks);
      data.blocks.forEach(block => visit(block, "global"));
    } else {
      console.warn('⚠️ Unknown data format, creating sample timeline');
      // Create a simple test timeline
      timeline.push({
        event: "var",
        data: {
          name: "sample",
          value: "test",
          scope: "global",
          type: "variable"
        }
      });
    }
    
    console.log('📈 Generated timeline with', timeline.length, 'events:', timeline);
  }

  function visit(node, parentScope = "global") {
    if (!node || typeof node !== 'object') {
      console.warn('⚠️ Invalid node:', node);
      return;
    }

    console.log(`🔍 Visiting node: ${node.type}`, node);

    switch (node.type) {
      case "class_declaration":
        // Handle class declarations
        console.log(`📦 Processing class: ${node.name}`);
        if (node.members && Array.isArray(node.members)) {
          node.members.forEach(member => {
            if (member.type === "constructor" && member.body) {
              timeline.push({ event: "push", scope: `constructor:${node.name}` });
              member.body.forEach(stmt => visit(stmt, `constructor:${node.name}`));
              timeline.push({ event: "pop", scope: `constructor:${node.name}` });
            } else if (member.type === "member_function" && member.body) {
              timeline.push({ event: "push", scope: `function:${node.name}.${member.name}` });
              
              // Add parameters
              if (member.params) {
                member.params.forEach(param => {
                  timeline.push({
                    event: "var",
                    data: {
                      name: param.name,
                      value: "param",
                      scope: `function:${node.name}.${member.name}`,
                      type: "parameter"
                    }
                  });
                });
              }
              
              member.body.forEach(stmt => visit(stmt, `function:${node.name}.${member.name}`));
              timeline.push({ event: "pop", scope: `function:${node.name}.${member.name}` });
            }
          });
        }
        break;

      case "declaration":
        if (node.declarations) {
          node.declarations.forEach(d => {
            const isPointer = d.pointer === true;
            const allocNew = d.allocation === "new";
            const size = d.array_size || 1;

            // Add the variable to the stack
            timeline.push({
              event: "var",
              data: {
                name: d.name,
                value: d.value ?? null,
                scope: d.scope ?? parentScope,
                type: isPointer ? "pointer" : (d.array_size ? "array" : "variable"),
                array_size: d.array_size,
                values: d.values,
                allocation: d.allocation,
                pointsTo: allocNew ? d.name + "_heap" : (d.points_to?.name ?? null)
              }
            });

            // If it's a heap allocation, add the heap memory
            if (allocNew) {
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
            }
          });
        }
        break;

      case "class_pointer_declaration":
        // Handle new Node{} style allocations
        console.log(`🆕 Processing heap allocation: ${node.name}`, node);
        
        // Add the pointer variable
        timeline.push({
          event: "var",
          data: {
            name: node.name,
            value: null,
            scope: node.scope || parentScope,
            type: "pointer",
            allocation: node.allocation,
            pointsTo: node.name + "_heap",
            class_type: node.class_type
          }
        });

        // Add the heap object
        if (node.allocation === "new") {
          timeline.push({
            event: "var",
            data: {
              name: node.name + "_heap",
              scope: "heap",
              type: "heap",
              class_type: node.class_type,
              allocation: "new",
              constructor_type: node.constructor_type
            }
          });
        }
        break;

      case "assignment":
        timeline.push({
          event: "var",
          data: {
            name: node.name,
            value: node.value,
            scope: node.scope ?? parentScope,
            type: "assignment",
            allocation: node.allocation
          }
        });
        break;

      case "member_assignment":
        // Handle newNode->data = value style assignments
        console.log(`📝 Processing member assignment: ${node.object}.${node.member}`, node);
        
        timeline.push({
          event: "member_assign",
          data: {
            object: node.object,
            member: node.member,
            value: node.value,
            scope: node.scope || parentScope,
            pointer_access: node.pointer_access
          }
        });
        break;

      case "if_statement":
        if (node.if_body) {
          timeline.push({ event: "push", scope: "if_body" });
          node.if_body.forEach(stmt => visit(stmt, "if_body"));
          timeline.push({ event: "pop", scope: "if_body" });
        }
        if (node.else_body) {
          timeline.push({ event: "push", scope: "else_body" });
          node.else_body.forEach(stmt => visit(stmt, "else_body"));
          timeline.push({ event: "pop", scope: "else_body" });
        }
        break;

      case "while_statement":
        if (node.body) {
          timeline.push({ event: "push", scope: "while_loop" });
          node.body.forEach(stmt => visit(stmt, "while_loop"));
          timeline.push({ event: "pop", scope: "while_loop" });
        }
        break;

      case "function declaration":
      case "the standard Main_Function ":
        const functionName = node.name || "main";
        timeline.push({ event: "push", scope: functionName });
        
        // Add parameters
        if (node.params) {
          node.params.forEach(p => {
            timeline.push({
              event: "var",
              data: {
                name: p.name,
                value: "param",
                scope: functionName,
                type: "parameter"
              }
            });
          });
        }
        
        // Process function body
        if (node.body) {
          node.body.forEach(n => visit(n, functionName));
        }
        
        timeline.push({ event: "pop", scope: functionName });
        break;

      case "function_call":
        timeline.push({ event: "push", scope: node.name });
        if (node.body) {
          node.body.forEach(n => visit(n, node.name));
        }
        timeline.push({ event: "pop", scope: node.name });
        break;

      default:
        console.log(`🤷 Unknown node type: ${node.type}, trying to process children`);
        // Try to process any children/body/members
        if (node.body && Array.isArray(node.body)) {
          node.body.forEach(child => visit(child, parentScope));
        } else if (node.members && Array.isArray(node.members)) {
          node.members.forEach(child => visit(child, parentScope));
        }
        break;
    }
  }

  function visibleVars() {
    const activeScopes = currentStack();
    const variables = new Map(); // Use Map to track latest state of each variable
    
    // Process all events up to current step
    for (let i = 0; i < step; i++) {
      const e = timeline[i];
      
      if (e.event === "var" && activeScopes.includes(e.data.scope)) {
        // Regular variable declaration/assignment
        const key = `${e.data.scope}:${e.data.name}`;
        variables.set(key, { ...e.data });
      } else if (e.event === "member_assign") {
        // Handle member assignments like newNode->data = value
        const objectKey = `${e.data.scope || 'global'}:${e.data.object}`;
        const heapKey = `heap:${e.data.object}_heap`;
        
        // Update the heap object's member
        if (variables.has(heapKey)) {
          const heapObj = variables.get(heapKey);
          if (!heapObj.members) heapObj.members = {};
          heapObj.members[e.data.member] = e.data.value;
          variables.set(heapKey, heapObj);
        }
      }
    }
    
    return Array.from(variables.values());
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

  // **COMPLETE VISUALIZATION RESET** function for clean state management
  window.resetVisualization = function() {
    console.log('🔄 Resetting visualization state...');
    
    // Reset global state
    timeline = [];
    step = 0;
    variablePositions = {};
    pointerLinks = [];
    
    // Clear SVG content completely
    const svg = d3.select("#main-svg");
    if (svg.node()) {
      svg.selectAll("*").remove();
      // Reset SVG attributes to defaults
      svg.attr("viewBox", "0 0 1200 600")
         .attr("width", "100%")
         .attr("height", "100%");
      console.log('🧹 Cleared and reset SVG content');
    }
    
    // Clear stack section completely
    const stackSection = document.getElementById("stack-section");
    if (stackSection) {
      stackSection.innerHTML = '';
      console.log('🧹 Cleared stack section');
    }
    
    // Reset step info
    const stepInfo = document.getElementById("step-info");
    if (stepInfo) {
      stepInfo.textContent = 'Step: 0/0';
      console.log('🧹 Reset step info');
    }
    
    // **ENHANCED CLEANUP**: Clear any existing zoom transforms
    const visualizationMain = document.getElementById('visualization-main');
    if (visualizationMain) {
      visualizationMain.style.transform = '';
      visualizationMain.style.transformOrigin = '';
      console.log('🧹 Reset visualization transforms');
    }
    
    // **MEMORY CLEANUP**: Force garbage collection of D3 selections
    if (typeof window.gc === 'function') {
      window.gc();
    }
    
    console.log('✅ Complete visualization reset finished');
  };

  function render() {
    console.log(`🎨 Rendering step ${step}/${timeline.length}`);
    
    // **ENHANCED BOUNDS CHECKING**: Ensure timeline is valid
    if (timeline.length === 0) {
      console.warn('⚠️ Empty timeline - nothing to render');
      
      // Show empty state message
      const svg = d3.select("#main-svg");
      if (svg.node()) {
        svg.selectAll("*").remove();
        svg.append("text")
          .attr("x", 600)
          .attr("y", 300)
          .attr("text-anchor", "middle")
          .attr("fill", "#858585")
          .attr("font-family", "Arial, sans-serif")
          .attr("font-size", "18px")
          .text("No timeline data available");
      }
      return;
    }
    
    // **STEP BOUNDS VALIDATION**: Ensure step is within valid range
    if (step < 0) {
      console.warn(`⚠️ Step ${step} is below 0, resetting to 0`);
      step = 0;
    } else if (step > timeline.length) {
      console.warn(`⚠️ Step ${step} exceeds timeline length ${timeline.length}, resetting to max`);
      step = timeline.length;
    }
    
    const vars = visibleVars();
    const stack = currentStack();
    const varsByScope = groupByScope(vars);

    console.log(`📊 Rendering: ${vars.length} variables, ${stack.length} scopes at step ${step}/${timeline.length}`);

    // **MEMORY VISUALIZATION**: Draw main visualization
    drawMemorySections(vars);
    
    // **STACK FRAMES**: Draw right panel frames
    drawRightFrames(stack, varsByScope);
    
    // **UI STATE UPDATES**: Update step information
    const stepInfo = document.getElementById("step-info");
    if (stepInfo) {
      stepInfo.textContent = `Step: ${step}/${timeline.length}`;
    }
    
    // **REACT CALLBACK**: Notify React components of state changes
    if (typeof window.onStepChange === 'function') {
      window.onStepChange({
        currentStep: step,
        totalSteps: timeline.length,
        stepData: timeline[step] || null,
        visibleVariables: vars.length,
        activeScopes: stack.length
      });
    }
    
    console.log(`✅ Rendered step ${step}: ${vars.length} variables, ${stack.length} scopes`);
  }

  function drawMemorySections(vars) {
    console.log('🖼️ Drawing memory sections with variables:', vars);
    
    const svg = d3.select("#main-svg");
    if (!svg.node()) {
      console.error('❌ SVG element #main-svg not found');
      return;
    }
    
    // **COMPLETE CLEANUP**: Remove all previous content and reset state
    svg.selectAll("*").remove();
    variablePositions = {};
    pointerLinks = [];
    console.log('🧹 Cleared previous visualization content and reset state');
    
    // Get container dimensions dynamically with fallbacks
    const container = document.getElementById('visualization-main') || svg.node().parentElement;
    const containerWidth = container ? Math.max(container.clientWidth, 1200) : 1200;
    const containerHeight = container ? Math.max(container.clientHeight - 100, 600) : 600;
    
    console.log(`📐 Container dimensions: ${containerWidth}x${containerHeight}`);
    
    // **RESPONSIVE SVG SIZING**: Set SVG dimensions with proper viewBox
    const width = Math.max(containerWidth, 1200); // Minimum 1200px width
    const height = Math.max(containerHeight, 600); // Minimum 600px height
    
    svg.attr("width", width)
       .attr("height", height)
       .attr("viewBox", `0 0 ${width} ${height}`) // Dynamic viewBox
       .attr("preserveAspectRatio", "xMinYMin meet"); // Better scaling
    
    console.log(`📏 SVG dimensions: ${width}x${height}, viewBox: 0 0 ${width} ${height}`);

    // **IMPROVED LAYOUT CALCULATIONS**: More spacing, better proportions
    const pad = 60; // Increased padding
    const headerHeight = 40; // Space for section labels
    const availableWidth = width - (pad * 2);
    const availableHeight = height - headerHeight - pad;
    
    // Calculate section widths with gap for divider
    const dividerGap = 40;
    const sectionWidth = (availableWidth - dividerGap) / 2;
    
    const stackX = pad;
    const heapX = pad + sectionWidth + dividerGap;
    const sectionY = headerHeight + 20;
    
    console.log(`📊 Layout: Stack at ${stackX} (width: ${sectionWidth}), Heap at ${heapX} (width: ${sectionWidth}), Section Y at ${sectionY}`);

    // **ENHANCED SECTION LABELS** with better visibility
    svg.append("text").text("Stack Memory")
      .attr("x", stackX + sectionWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .attr("stroke", "#1e1e1e") // Dark outline for better contrast
      .attr("stroke-width", 0.5);

    svg.append("text").text("Heap Memory")
      .attr("x", heapX + sectionWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "bold")
      .attr("fill", "#ffffff")
      .attr("stroke", "#1e1e1e") // Dark outline for better contrast
      .attr("stroke-width", 0.5);

    // **ENHANCED VISUAL DIVIDER** between Stack and Heap
    const dividerX = stackX + sectionWidth + dividerGap / 2;
    svg.append("line")
      .attr("x1", dividerX)
      .attr("y1", 10)
      .attr("x2", dividerX)
      .attr("y2", height - 20)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "8,4")
      .attr("opacity", 0.6);

    // **IMPROVED VARIABLE CLASSIFICATION** with enhanced heap detection
    let stackVars = vars.filter(v => {
      // **ENHANCED STACK DETECTION**: Variables that should be on stack
      const isStackVar = (
        // Regular variables and primitives
        (v.type === "variable" && v.scope !== "heap" && v.allocation !== "new") ||
        // Pointers themselves (but not what they point to)
        (v.type === "pointer" && v.scope !== "heap" && !v.name.endsWith('_heap')) ||
        // Parameters and local variables
        (v.type === "parameter") ||
        // Assignment statements
        (v.type === "assignment" && v.scope !== "heap")
      );
      
      const isHeap = v.scope === "heap" || v.allocation === "new" || v.type === "heap" || v.name.endsWith('_heap');
      const result = isStackVar && !isHeap;
      
      console.log(`🔍 Variable ${v.name}: type=${v.type}, scope=${v.scope}, allocation=${v.allocation} → ${result ? 'STACK' : 'HEAP'}`);
      return result;
    });
    
    let heapVars = vars.filter(v => {
      // **ENHANCED HEAP DETECTION**: Objects allocated on heap
      const isHeapVar = (
        // Explicitly heap-scoped variables
        v.scope === "heap" ||
        // New allocations
        v.allocation === "new" ||
        // Heap type markers
        v.type === "heap" ||
        // Generated heap object names
        v.name.endsWith('_heap') ||
        // Class instances with heap allocation
        (v.class_type && v.allocation === "new")
      );
      
      console.log(`🏗️ Variable ${v.name}: heap check → ${isHeapVar ? 'HEAP' : 'STACK'}`);
      return isHeapVar;
    });
    
    console.log(`🔍 Enhanced variable distribution:`);
    console.log(`  📚 Stack variables (${stackVars.length}):`, stackVars.map(v => `${v.name}(${v.type}${v.class_type ? ':' + v.class_type : ''})`));
    console.log(`  🎯 Heap variables (${heapVars.length}):`, heapVars.map(v => `${v.name}(${v.type}${v.class_type ? ':' + v.class_type : ''})`));
    
    // **LINKED LIST DETECTION**: Special logging for Node-type objects
    const linkedListNodes = heapVars.filter(v => 
      v.class_type && (
        v.class_type.toLowerCase().includes('node') ||
        v.name.toLowerCase().includes('node') ||
        (v.members && Object.keys(v.members).some(key => key === 'next' || key === 'data'))
      )
    );
    
    console.log(`🔗 Detected ${linkedListNodes.length} linked list nodes:`, linkedListNodes);
    linkedListNodes.forEach((node, i) => {
      console.log(`  ${i + 1}. ${node.name}: class=${node.class_type}, members=`, node.members);
    });
    
    // Special logging for heap objects with class types
    const heapObjects = heapVars.filter(v => v.type === "heap" && v.class_type);
    console.log(`  🏗️ Heap objects with class types (${heapObjects.length}):`, heapObjects);

    // **DRAW VARIABLES** with enhanced bounds checking
    const stackDrawHeight = availableHeight - 50; // Leave space for controls
    const heapDrawHeight = availableHeight - 50;
    
    drawVariables(svg, stackVars, stackX, sectionY, "stack", sectionWidth, stackDrawHeight);
    drawVariables(svg, heapVars, heapX, sectionY, "heap", sectionWidth, heapDrawHeight);

    // **POINTER LINK PROCESSING** with enhanced detection
    stackVars.forEach(v => {
      if (v.type === "pointer" && v.pointsTo) {
        console.log(`🔗 Adding stack pointer link: ${v.name} → ${v.pointsTo}`);
        pointerLinks.push({ from: v.name, to: v.pointsTo });
      }
    });

    // Check for linked list connections in heap objects
    heapVars.forEach(v => {
      if (v.members && v.members.next && v.members.next !== 'nullptr' && v.members.next !== 'NULL') {
        console.log(`🔗 Adding heap object link: ${v.name} → ${v.members.next}`);
        pointerLinks.push({ from: v.name, to: v.members.next });
      }
    });

    console.log(`🎨 Drawing ${pointerLinks.length} pointer arrows with enhanced white styling`);
    drawPointerArrows(svg);
    
    // **BOUNDS VALIDATION**: Check if all elements are within viewport
    const svgBounds = svg.node().getBoundingClientRect();
    let elementsOutOfBounds = 0;
    
    Object.entries(variablePositions).forEach(([name, pos]) => {
      if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) {
        console.warn(`⚠️ Element ${name} at (${pos.x}, ${pos.y}) is outside SVG bounds (${width}x${height})`);
        elementsOutOfBounds++;
      }
    });
    
    if (elementsOutOfBounds > 0) {
      console.warn(`⚠️ ${elementsOutOfBounds} elements are positioned outside bounds`);
    } else {
      console.log(`✅ All elements are within bounds`);
    }
    
    console.log('📍 Final variable positions:', variablePositions);
    console.log(`✅ Memory sections rendering complete: ${stackVars.length} stack + ${heapVars.length} heap variables`);
  }

  function drawVariables(svg, vars, baseX, baseY, area, sectionWidth, availableHeight) {
    console.log(`🎨 Drawing ${vars.length} variables in ${area} section at base (${baseX}, ${baseY})`);
    console.log(`📏 Section constraints: width=${sectionWidth}, height=${availableHeight}`);
    
    const r = 30;
    const sx = 140, sy = 100;
    const maxCols = Math.floor(sectionWidth / sx) || 2; // Ensure at least 2 columns
    
    console.log(`📐 Grid layout: ${maxCols} columns, ${sx}px spacing X, ${sy}px spacing Y`);

    vars.forEach((v, i) => {
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      let cx = baseX + col * sx;
      let cy = baseY + row * sy;
      
      // **BOUNDS ENFORCEMENT**: Constrain elements within section bounds
      const elementWidth = v.type === "heap" && v.class_type ? 120 : (v.array_size ? v.array_size * 40 : r * 2);
      const elementHeight = v.type === "heap" && v.class_type ? 
        (v.members ? 80 + (Object.keys(v.members).length * 12) : 80) : 
        (v.array_size ? 30 : r * 2);
      
      // Constrain X position
      const minX = baseX + elementWidth / 2;
      const maxX = baseX + sectionWidth - elementWidth / 2;
      cx = Math.max(minX, Math.min(maxX, cx));
      
      // Constrain Y position
      const minY = baseY + elementHeight / 2;
      const maxY = baseY + availableHeight - elementHeight / 2;
      cy = Math.max(minY, Math.min(maxY, cy));
      
      // Log if position was adjusted
      const originalCx = baseX + col * sx;
      const originalCy = baseY + row * sy;
      if (cx !== originalCx || cy !== originalCy) {
        console.log(`📍 Adjusted ${v.name} position: (${originalCx}, ${originalCy}) → (${cx}, ${cy}) to stay within bounds`);
      }

      variablePositions[v.name] = { x: cx, y: cy };
      
      console.log(`📍 Positioning ${v.name} (${v.type}${v.class_type ? ':' + v.class_type : ''}) at (${cx}, ${cy}) in ${area}`);

      // Handle heap objects (like Node instances)
      if (v.type === "heap" && v.class_type) {
        console.log(`🏗️ Rendering heap object: ${v.name} of type ${v.class_type}`);
        
        const objWidth = 120; // Slightly wider for better text fit
        const objHeight = v.members ? 80 + (Object.keys(v.members).length * 12) : 80; // Dynamic height based on members
        const x = cx - objWidth / 2;
        const y = cy - objHeight / 2;

        // Draw heap object container with better visibility
        svg.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", objWidth)
          .attr("height", objHeight)
          .attr("fill", "#1a4d66") // Darker blue for better contrast
          .attr("stroke", "#ffffff") // White border for visibility
          .attr("stroke-width", 2)
          .attr("rx", 8);

        // Add class type label with white text
        svg.append("text")
          .attr("x", cx)
          .attr("y", y + 15)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .attr("fill", "#ffffff") // White text for visibility
          .text(v.class_type);

        // Add object name with white text
        svg.append("text")
          .attr("x", cx)
          .attr("y", y + 30)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("fill", "#cccccc") // Light gray for secondary text
          .text(v.name.replace('_heap', ''));

        // Display members if available with white text
        if (v.members) {
          console.log(`📄 Rendering ${Object.keys(v.members).length} members for ${v.name}:`, v.members);
          let memberY = y + 50;
          Object.entries(v.members).forEach(([key, value]) => {
            svg.append("text")
              .attr("x", cx)
              .attr("y", memberY)
              .attr("text-anchor", "middle")
              .attr("font-size", "9px")
              .attr("fill", "#ffffff") // White text for member values
              .text(`${key}: ${value?.name || value}`);
            memberY += 12;
          });
        } else {
          console.log(`📝 No members found for heap object ${v.name}`);
        }

        // Check if this object has pointers to next objects
        if (v.members && v.members.next && v.members.next !== 'nullptr') {
          console.log(`🔗 Found next pointer in ${v.name} pointing to ${v.members.next}`);
          pointerLinks.push({ from: v.name, to: v.members.next });
        }

      } else if (v.type === "heap" || (v.array_size && v.array_size > 1)) {
        // Handle arrays and basic heap allocations
        console.log(`📊 Rendering array/heap allocation: ${v.name}`);
        
        const cellWidth = 40;
        const cellHeight = 30;
        const length = v.array_size || 1;

        // Draw array container with better visibility
        svg.append("rect")
          .attr("x", cx - (length * cellWidth) / 2)
          .attr("y", cy - cellHeight / 2)
          .attr("width", length * cellWidth)
          .attr("height", cellHeight)
          .attr("fill", v.type === "heap" ? "#2d5a2d" : "#5a2d2d") // Darker colors for contrast
          .attr("stroke", "#ffffff") // White border
          .attr("stroke-width", 1);

        // Draw cell dividers and values
        for (let j = 0; j < length; j++) {
          const cellX = cx - (length * cellWidth) / 2 + j * cellWidth;
          
          // Draw cell divider in white
          svg.append("line")
            .attr("x1", cellX)
            .attr("y1", cy - cellHeight / 2)
            .attr("x2", cellX)
            .attr("y2", cy + cellHeight / 2)
            .attr("stroke", "#ffffff") // White dividers
            .attr("stroke-width", 1);

          // Add cell value with white text
          const value = v.values && v.values[j] !== undefined ? v.values[j] : "?";
          svg.append("text")
            .attr("x", cellX + cellWidth / 2)
            .attr("y", cy + 5)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#ffffff") // White text
            .text(value);
        }

        // Add variable name with white text
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - cellHeight / 2 - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "13px")
          .attr("fill", "#ffffff") // White text for variable name
          .text(v.name);

      } else {
        // Regular variables (non-array, non-heap objects)
        console.log(`⭕ Rendering regular variable: ${v.name} (${v.type})`);
        
        const fill = v.type === "pointer" ? "#4da6d9" : "#d9774d"; // Darker colors for better contrast
        svg.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", r)
          .attr("fill", fill)
          .attr("stroke", "#ffffff") // White border
          .attr("stroke-width", 2);

        // Add variable name and value with white text
        let displayText = v.name;
        if (v.value !== null && v.value !== undefined) {
          displayText += ` = ${v.value?.name || v.value}`;
        }
        
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy + 5)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", "14px")
          .attr("fill", "#ffffff") // White text for readability
          .text(displayText);

        // Queue pointer arrow if it's a pointer
        if (v.type === "pointer" && v.pointsTo) {
          console.log(`🎯 Adding pointer from ${v.name} to ${v.pointsTo}`);
          pointerLinks.push({ from: v.name, to: v.pointsTo });
        }
      }
    });
    
    console.log(`✅ Completed drawing ${vars.length} variables in ${area} section`);
  }

  function drawPointerArrows(svg) {
    console.log(`🎯 Drawing ${pointerLinks.length} pointer arrows with enhanced white styling`);
    
    // **ENHANCED ARROW MARKERS**: Multiple markers for different pointer types
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    
    // Standard white arrow marker
    defs.append("marker")
      .attr("id", "arrowhead-white")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 10) // Larger for better visibility
      .attr("markerHeight", 10)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ffffff") // Pure white
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);
      
    // Highlighted arrow marker for linked list pointers
    defs.append("marker")
      .attr("id", "arrowhead-linked-list")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 12) // Even larger
      .attr("markerHeight", 12)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#00ff88") // Bright green-cyan for linked lists
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);

    pointerLinks.forEach((link, index) => {
      const from = variablePositions[link.from];
      const to = variablePositions[link.to];
      
      if (from && to) {
        console.log(`🔗 Drawing enhanced arrow ${index + 1}: ${link.from} → ${link.to} at (${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if nodes are too close
        if (distance < 50) {
          console.log(`⚠️ Skipping arrow - nodes too close (${distance}px)`);
          return;
        }
        
        const angle = Math.atan2(dy, dx);
        const offset = 35; // Offset from node edge

        // Calculate start and end points
        const x1 = from.x + offset * Math.cos(angle);
        const y1 = from.y + offset * Math.sin(angle);
        const x2 = to.x - offset * Math.cos(angle);
        const y2 = to.y - offset * Math.sin(angle);

        // **ENHANCED POINTER TYPE DETECTION**: Determine if this is a linked list pointer
        const isLinkedListPointer = (
          link.from.toLowerCase().includes('node') || 
          link.to.toLowerCase().includes('node') ||
          link.from.includes('_heap') || 
          link.to.includes('_heap') ||
          link.from.includes('head') ||
          link.from.includes('next') ||
          link.to.includes('head') ||
          link.to.includes('next')
        );
        
        // **ENHANCED STYLING**: Different styles for different pointer types
        const arrowStyle = isLinkedListPointer ? {
          stroke: "#00ff88", // Bright green-cyan for linked list pointers
          strokeWidth: 4,
          marker: "url(#arrowhead-linked-list)",
          opacity: 1.0,
          dashArray: "none"
        } : {
          stroke: "#ffffff", // Pure white for regular pointers
          strokeWidth: 3,
          marker: "url(#arrowhead-white)",
          opacity: 0.95,
          dashArray: "none"
        };

        // **GLOW EFFECT**: Add subtle shadow/glow for better visibility
        svg.append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", arrowStyle.stroke)
          .attr("stroke-width", arrowStyle.strokeWidth + 2)
          .attr("opacity", 0.3)
          .attr("stroke-linecap", "round")
          .style("filter", "blur(2px)");

        // **MAIN ARROW LINE**: Enhanced arrow with maximum visibility
        svg.append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", arrowStyle.stroke)
          .attr("stroke-width", arrowStyle.strokeWidth)
          .attr("stroke-dasharray", arrowStyle.dashArray)
          .attr("marker-end", arrowStyle.marker)
          .attr("opacity", arrowStyle.opacity)
          .attr("stroke-linecap", "round") // Rounded line caps
          .attr("stroke-linejoin", "round"); // Rounded joins
          
        console.log(`✅ Drew enhanced ${isLinkedListPointer ? 'linked list' : 'regular'} arrow from (${x1}, ${y1}) to (${x2}, ${y2})`);
      } else {
        console.warn(`⚠️ Cannot draw arrow for ${link.from} → ${link.to}: missing position data`, {
          from: from,
          to: to,
          allPositions: Object.keys(variablePositions)
        });
      }
    });
    
    console.log(`✅ Completed drawing ${pointerLinks.length} enhanced pointer arrows`);
  }

  function drawRightFrames(stack, varsByScope) {
    const container = document.getElementById("stack-section");
    if (!container) return;
    
    container.innerHTML = "";

    if (!stack.includes("global")) stack.unshift("global");

    stack.forEach(scope => {
      const frame = document.createElement("div");
      frame.style.border = `2px solid ${scope === "global" ? "#28a745" : "#007acc"}`;
      frame.style.padding = "8px";
      frame.style.marginBottom = "10px";
      frame.style.borderRadius = "8px";
      frame.style.fontFamily = "monospace";
      frame.style.background = "#2d2d30";
      frame.style.color = "#d4d4d4";

      const title = document.createElement("div");
      title.textContent = `Scope: ${scope}`;
      title.style.color = scope === "global" ? "#28a745" : "#007acc";
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
        line.style.fontSize = "12px";
        line.style.marginBottom = "2px";
        frame.appendChild(line);
      });

      container.appendChild(frame);
    });
  }

  // Navigation functions
  window.nextStep = function() {
    if (step < timeline.length) {
      step++;
      render();
      console.log(`📈 Advanced to step ${step}/${timeline.length}`);
    } else {
      console.log('⚠️ Already at last step');
    }
  };

  window.prevStep = function() {
    if (step > 0) {
      step--;
      render();
      console.log(`📉 Moved back to step ${step}/${timeline.length}`);
    } else {
      console.log('⚠️ Already at first step');
    }
  };

  // Enhanced navigation functions as requested
  window.goToNextStep = function() {
    console.log('🔜 goToNextStep called');
    window.nextStep();
  };

  window.goToPreviousStep = function() {
    console.log('🔙 goToPreviousStep called');  
    window.prevStep();
  };

  window.renderStep = function(stepIndex) {
    console.log(`🎯 renderStep called with index: ${stepIndex}`);
    
    if (stepIndex >= 0 && stepIndex < timeline.length) {
      step = stepIndex;
      render();
      console.log(`✅ Rendered step ${step}/${timeline.length}`);
    } else {
      console.warn(`⚠️ Invalid step index: ${stepIndex}. Valid range: 0-${timeline.length - 1}`);
    }
  };

  window.getCurrentStep = function() {
    return {
      currentStep: step,
      totalSteps: timeline.length,
      stepData: timeline[step] || null
    };
  };

  window.getTimelineLength = function() {
    return timeline.length;
  };

  // Enhanced load data function for better file handling
  window.loadData = function(customData) {
    console.log('📊 Loading visualization data:', customData);
    
    if (customData) {
      // Use provided data directly
      if (Array.isArray(customData)) {
        processTimelineData(customData);
        render();
      } else if (customData.blocks || customData.functions) {
        // Handle analysis data format
        const blocks = customData.blocks || [];
        processTimelineData(blocks);
        render();
      } else {
        console.warn('⚠️ Unexpected data format:', customData);
        testDraw();
      }
    } else if (window.visualizationData) {
      // Use global data
      processTimelineData(window.visualizationData);
      render();
    } else {
      // Try to load from various sources
      console.log('🔍 Attempting to load data from available sources...');
      
      // Try data.json first
      fetch('/data/data.json')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          console.log('✅ Loaded data from /data/data.json');
          window.loadData(data);
        })
        .catch(err => {
          console.log('⚠️ Could not load /data/data.json, trying data.json...');
          
          // Try root data.json
          return fetch('/data.json')
            .then(response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            })
            .then(data => {
              console.log('✅ Loaded data from /data.json');
              window.loadData(data);
            })
            .catch(err2 => {
              console.warn('⚠️ Could not load any data files, using test visualization');
              testDraw();
            });
        });
    }
  };

  // Initialize event listeners when DOM is ready
  function initializeControls() {
    // Navigation buttons
    const nextBtn = document.getElementById("nextBtn");
    const backBtn = document.getElementById("backBtn");
    
    if (nextBtn) {
      nextBtn.addEventListener("click", nextStep);
    }
    
    if (backBtn) {
      backBtn.addEventListener("click", prevStep);
    }
    
    console.log('✅ Visualization controls initialized');
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeControls);
  } else {
    initializeControls();
  }

  // Make functions globally available
  window.initVisualization = initializeControls;
  window.drawTestVisualization = testDraw;
  
  console.log('🎨 Enhanced visualization script loaded successfully');

})();