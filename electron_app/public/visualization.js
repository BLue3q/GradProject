// Sample visualization module for C++ code analysis
(function() {
  'use strict';

  // Main visualization function exposed to the global scope
  window.renderVisualization = function(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found:', containerId);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Create visualization wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
      overflow: auto;
      background-color: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 14px;
    `;

    // Add title
    const title = document.createElement('h3');
    title.textContent = 'C++ Code Analysis';
    title.style.cssText = 'margin-top: 0; color: #4ec9b0; border-bottom: 1px solid #3e3e3e; padding-bottom: 10px;';
    wrapper.appendChild(title);

    // Display metrics
    if (data.metrics) {
      const metricsSection = createSection('Code Metrics', [
        `Lines: ${data.metrics.lines}`,
        `Characters: ${data.metrics.characters}`,
        `Tokens: ${data.metrics.tokens || 0}`
      ]);
      wrapper.appendChild(metricsSection);
    }

    // Display includes
    if (data.includes && data.includes.length > 0) {
      const includesList = data.includes.map(inc => 
        `<span style="color: #ce9178;">#include</span> &lt;${inc.name}&gt; <span style="color: #6a9955;">// line ${inc.line}</span>`
      );
      const includesSection = createSection('Includes', includesList, true);
      wrapper.appendChild(includesSection);
    }

    // Display functions
    if (data.functions && data.functions.length > 0) {
      const functionsList = data.functions.map(func => 
        `<span style="color: #569cd6;">${func.return_type}</span> <span style="color: #dcdcaa;">${func.name}</span>() <span style="color: #6a9955;">// line ${func.line}</span>`
      );
      const functionsSection = createSection('Functions', functionsList, true);
      wrapper.appendChild(functionsSection);
    }

    // Display classes
    if (data.classes && data.classes.length > 0) {
      const classesList = data.classes.map(cls => 
        `<span style="color: #569cd6;">class</span> <span style="color: #4ec9b0;">${cls.name}</span> <span style="color: #6a9955;">// line ${cls.line}</span>`
      );
      const classesSection = createSection('Classes', classesList, true);
      wrapper.appendChild(classesSection);
    }

    // Display variables
    if (data.variables && data.variables.length > 0) {
      const variablesList = data.variables.map(v => 
        `<span style="color: #569cd6;">${v.type}</span> <span style="color: #9cdcfe;">${v.name}</span> <span style="color: #6a9955;">// line ${v.line}</span>`
      );
      const variablesSection = createSection('Variables', variablesList, true);
      wrapper.appendChild(variablesSection);
    }

    // Display token analysis
    if (data.tokens && data.tokens.length > 0) {
      const tokenTypes = {};
      data.tokens.forEach(token => {
        tokenTypes[token.type] = (tokenTypes[token.type] || 0) + 1;
      });
      
      const tokensList = Object.entries(tokenTypes).map(([type, count]) => 
        `${type}: ${count}`
      );
      const tokensSection = createSection('Token Distribution', tokensList);
      wrapper.appendChild(tokensSection);
    }

    // Add visualization diagram if available
    if (data.visualization && data.visualization.nodes.length > 0) {
      const diagramSection = createDiagram(data.visualization);
      wrapper.appendChild(diagramSection);
    }

    container.appendChild(wrapper);
  };

  // Helper function to create a section
  function createSection(title, items, isHtml = false) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 20px;';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = 'color: #569cd6; margin-bottom: 10px; font-size: 16px;';
    section.appendChild(sectionTitle);

    const list = document.createElement('ul');
    list.style.cssText = 'margin: 0; padding-left: 20px; list-style-type: none;';

    items.forEach(item => {
      const li = document.createElement('li');
      li.style.cssText = 'margin-bottom: 5px; padding: 4px 8px; background-color: #252526; border-radius: 3px;';
      if (isHtml) {
        li.innerHTML = item;
      } else {
        li.textContent = item;
      }
      list.appendChild(li);
    });

    section.appendChild(list);
    return section;
  }

  // Helper function to create a simple diagram
  function createDiagram(vizData) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 20px;';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = 'Code Structure Diagram';
    sectionTitle.style.cssText = 'color: #569cd6; margin-bottom: 10px; font-size: 16px;';
    section.appendChild(sectionTitle);

    const canvas = document.createElement('div');
    canvas.style.cssText = `
      background-color: #252526;
      border: 1px solid #3e3e3e;
      border-radius: 4px;
      padding: 20px;
      min-height: 200px;
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      align-items: flex-start;
    `;

    // Create simple node representations
    vizData.nodes.forEach(node => {
      const nodeEl = document.createElement('div');
      nodeEl.style.cssText = `
        background-color: ${node.type === 'function' ? '#1e3a5f' : '#3a1e5f'};
        border: 2px solid ${node.type === 'function' ? '#569cd6' : '#c586c0'};
        border-radius: 6px;
        padding: 12px 16px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 80px;
        text-align: center;
      `;
      
      const icon = document.createElement('div');
      icon.textContent = node.type === 'function' ? 'ƒ' : 'C';
      icon.style.cssText = 'font-weight: bold; font-size: 18px; margin-bottom: 4px;';
      
      const label = document.createElement('div');
      label.textContent = node.label;
      label.style.cssText = 'font-size: 12px;';
      
      nodeEl.appendChild(icon);
      nodeEl.appendChild(label);
      
      nodeEl.onmouseover = () => {
        nodeEl.style.transform = 'scale(1.05)';
        nodeEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      };
      
      nodeEl.onmouseout = () => {
        nodeEl.style.transform = 'scale(1)';
        nodeEl.style.boxShadow = 'none';
      };
      
      nodeEl.onclick = () => {
        alert(`${node.type}: ${node.label}\nLine: ${node.data.line}`);
      };
      
      canvas.appendChild(nodeEl);
    });

    if (vizData.nodes.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.textContent = 'No functions or classes found in the code.';
      placeholder.style.cssText = 'color: #6a9955; font-style: italic; text-align: center; width: 100%;';
      canvas.appendChild(placeholder);
    }

    section.appendChild(canvas);
    return section;
  }

})(); 