// Wrapper script to integrate page visualization with React component
(function() {
  'use strict';

  // Global function to render visualization using page scripts
  window.renderVisualization = function(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found:', containerId);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Create iframe to load the page visualization
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background-color: #1e1e1e;
    `;
    
    // Create the HTML content for the iframe
    const iframeContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>C++ Visualization</title>
        <script src="https://d3js.org/d3.v7.min.js"></script>
        <link rel="stylesheet" href="/page/style.css">
        <style>
          body {
            margin: 0;
            padding: 20px;
            background-color: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Cascadia Code', monospace;
            overflow: auto;
          }
          #controls {
            margin-bottom: 20px;
            text-align: center;
          }
          button {
            background-color: #0e639c;
            color: white;
            border: none;
            padding: 8px 16px;
            margin: 0 5px;
            border-radius: 4px;
            cursor: pointer;
          }
          button:hover {
            background-color: #1177bb;
          }
          #main-svg {
            background-color: #252526;
            border: 1px solid #3e3e3e;
            border-radius: 4px;
          }
          #right-panel {
            background-color: #252526;
            border: 1px solid #3e3e3e;
            border-radius: 4px;
            padding: 10px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div id="controls">
          <button id="backBtn">← Previous</button>
          <button id="nextBtn">Next →</button>
          <span id="step-info" style="margin-left: 20px;">Step: <span id="current-step">0</span></span>
        </div>
        
        <svg id="main-svg" width="1200" height="600"></svg>
        
        <div id="right-panel">
          <h3>Call Stack & Variables</h3>
          <div id="frames-container"></div>
        </div>

        <script>
          // Inject the analysis data
          window.analysisData = ${JSON.stringify(data)};
          
          // Convert analysis data to timeline format expected by the visualization
          function convertAnalysisToTimeline(analysisData) {
            const timeline = [];
            
            // Add global scope
            timeline.push({
              event: "push",
              scope: "global",
              data: { name: "global" }
            });
            
            // Add variables from analysis
            if (analysisData.variables) {
              analysisData.variables.forEach((variable, index) => {
                timeline.push({
                  event: "var",
                  data: {
                    name: variable.name,
                    type: variable.type,
                    value: "?", // Default value since we don't have runtime values
                    scope: "global",
                    line: variable.line
                  }
                });
              });
            }
            
            // Add functions
            if (analysisData.functions) {
              analysisData.functions.forEach((func, index) => {
                timeline.push({
                  event: "push",
                  scope: func.name,
                  data: { name: func.name, type: "function", line: func.line }
                });
                
                // Add function return
                timeline.push({
                  event: "pop",
                  scope: func.name,
                  data: { name: func.name }
                });
              });
            }
            
            return timeline;
          }
          
          // Initialize timeline with converted data
          let timeline = convertAnalysisToTimeline(window.analysisData);
          let step = 0;
          
          // Update step info
          function updateStepInfo() {
            document.getElementById('current-step').textContent = step + ' / ' + timeline.length;
          }
          
          // Load and execute the visualization script
          fetch('/page/script.js')
            .then(response => response.text())
            .then(scriptContent => {
              // Execute the script in this context
              eval(scriptContent);
              
              // Override the original render function to include step info
              const originalRender = window.render;
              window.render = function() {
                if (originalRender) originalRender();
                updateStepInfo();
              };
              
              // Initial render
              render();
              updateStepInfo();
            })
            .catch(error => {
              console.error('Error loading visualization script:', error);
              document.body.innerHTML = '<div style="color: #f48771; padding: 20px;">Error loading visualization: ' + error.message + '</div>';
            });
        </script>
      </body>
      </html>
    `;
    
    // Set iframe content
    iframe.onload = function() {
      iframe.contentDocument.open();
      iframe.contentDocument.write(iframeContent);
      iframe.contentDocument.close();
    };
    
    container.appendChild(iframe);
  };

  // Fallback function for when page scripts are not available
  window.renderFallbackVisualization = function(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px; color: #d4d4d4; font-family: 'Cascadia Code', monospace;">
        <h3 style="color: #4ec9b0; margin-top: 0;">C++ Analysis Results</h3>
        <div style="background: #252526; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
          <h4 style="color: #569cd6; margin-top: 0;">Code Metrics</h4>
          <p>Lines: ${data.metrics?.lines || 0}</p>
          <p>Characters: ${data.metrics?.characters || 0}</p>
          <p>Tokens: ${data.metrics?.tokens || 0}</p>
        </div>
        
        ${data.functions && data.functions.length > 0 ? `
        <div style="background: #252526; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
          <h4 style="color: #569cd6; margin-top: 0;">Functions</h4>
          ${data.functions.map(f => `<p><span style="color: #dcdcaa;">${f.name}</span> (line ${f.line})</p>`).join('')}
        </div>
        ` : ''}
        
        ${data.variables && data.variables.length > 0 ? `
        <div style="background: #252526; padding: 15px; border-radius: 4px;">
          <h4 style="color: #569cd6; margin-top: 0;">Variables</h4>
          ${data.variables.map(v => `<p><span style="color: #569cd6;">${v.type}</span> <span style="color: #9cdcfe;">${v.name}</span> (line ${v.line})</p>`).join('')}
        </div>
        ` : ''}
      </div>
    `;
  };

})(); 