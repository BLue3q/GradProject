import React, { useState, useEffect, useRef } from 'react';
import './VisualizationPanel.css';

interface Block {
  id: string;
  description: string;
  line_range: [number, number];
  code: string;
  name?: string;
  type?: string;
  start_line?: number;
  end_line?: number;
}

interface AnalysisData {
  analysis?: {
    blocks?: Block[];
    functions?: any;
    tokens?: any[];
    ast?: any[];
    classes?: any;
  };
  summary?: {
    total_blocks?: number;
    blocks?: any[];
  };
  blocks?: Block[]; // Direct blocks from new pipeline
  ast?: any[]; // Direct AST from new pipeline
  functions?: any; // Direct functions from new pipeline
  classes?: any; // Direct classes from new pipeline
  blocksDir?: string;
}

interface CompilationData {
  results?: any;
  summary?: {
    total_blocks?: number;
    successful_compilations?: number;
    failed_compilations?: number;
    intermediate_files?: any[];
    errors?: any[];
  };
  blocksDir?: string;
}

interface VisualizationPanelProps {
  analysisData?: AnalysisData | null;
  compilationData?: CompilationData | null;
  isDebugging?: boolean;
  onVisualizationTrigger?: (triggerFn: (data: any) => void) => void;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  analysisData, 
  compilationData, 
  isDebugging = false,
  onVisualizationTrigger
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'compilation' | 'debug' | 'visualize'>('overview');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [visualizationLoaded, setVisualizationLoaded] = useState<boolean>(false);
  const [visualizationError, setVisualizationError] = useState<string>('');
  const [d3Loaded, setD3Loaded] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const visualizationContainerRef = useRef<HTMLDivElement>(null);

  // **ZOOM FUNCTIONALITY**: Handle keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle zoom when on visualize tab and Ctrl is pressed
      if (activeTab !== 'visualize' || !event.ctrlKey) return;
      
      switch (event.key) {
        case '+':
        case '=': // Also handle = key for easier access
          event.preventDefault();
          setZoomLevel(prev => {
            const newZoom = Math.min(prev + 0.2, 3.0); // Max zoom 3x
            console.log(`🔍 Zoom in: ${prev.toFixed(1)}x → ${newZoom.toFixed(1)}x`);
            return newZoom;
          });
          break;
          
        case '-':
          event.preventDefault();
          setZoomLevel(prev => {
            const newZoom = Math.max(prev - 0.2, 0.3); // Min zoom 0.3x
            console.log(`🔍 Zoom out: ${prev.toFixed(1)}x → ${newZoom.toFixed(1)}x`);
            return newZoom;
          });
          break;
          
        case '0':
          event.preventDefault();
          console.log(`🔍 Reset zoom: ${zoomLevel.toFixed(1)}x → 1.0x`);
          setZoomLevel(1.0);
          break;
      }
    };

    // Add event listener for the entire document
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, zoomLevel]);

  // **APPLY ZOOM**: Update zoom styling when zoom level changes
  useEffect(() => {
    const container = visualizationContainerRef.current;
    if (container && activeTab === 'visualize') {
      const visualizationMain = container.querySelector('#visualization-main') as HTMLElement;
      if (visualizationMain) {
        visualizationMain.style.transform = `scale(${zoomLevel})`;
        visualizationMain.style.transformOrigin = 'top left';
        
        // Adjust container size to accommodate zoom
        const parentContainer = visualizationMain.parentElement;
        if (parentContainer) {
          if (zoomLevel !== 1.0) {
            parentContainer.style.overflow = 'auto';
            // Adjust container dimensions to show scaled content properly
            visualizationMain.style.width = `${1200}px`;
            visualizationMain.style.height = `${600}px`;
          } else {
            parentContainer.style.overflow = 'hidden';
            visualizationMain.style.width = '100%';
            visualizationMain.style.height = '100%';
          }
        }
        
        console.log(`🎯 Applied zoom ${zoomLevel.toFixed(1)}x to visualization`);
      }
    }
  }, [zoomLevel, activeTab]);

  // Function to trigger visualization from external components
  const triggerVisualizationFromExternal = (data: any) => {
    console.log('🚀 External visualization trigger received:', data);
    console.log('🔍 Current active tab:', activeTab);
    
    // Only switch to visualize tab if explicitly requested, not automatically
    // This prevents unwanted redirects when data is updated
    if (activeTab === 'visualize') {
      console.log('📍 Already on visualize tab, executing visualization...');
      setTimeout(() => {
        executeVisualization(data?.analysis || data);
      }, 200);
    } else {
      console.log('📍 Not on visualize tab, storing data for later use');
      // Store the data but don't auto-switch tabs
      // User must manually click the Visualize tab
    }
  };

  // Register the trigger function with parent component
  useEffect(() => {
    if (onVisualizationTrigger) {
      onVisualizationTrigger(triggerVisualizationFromExternal);
    }
  }, [onVisualizationTrigger, activeTab]); // Add activeTab to deps

  // Load D3.js first, then script.js
  const loadVisualizationScript = async () => {
    try {
      setVisualizationError('');
      console.log('🔄 Starting visualization script loading...');
      
      // Step 1: Load D3.js if not already loaded
      if (typeof (window as any).d3 === 'undefined') {
        console.log('📦 Loading D3.js...');
        await loadD3Script();
      } else {
        console.log('✅ D3.js already loaded');
        setD3Loaded(true);
      }

      // Step 2: Load script.js if not already loaded
      if (!document.getElementById('visualization-script')) {
        console.log('📦 Loading visualization script...');
        await loadCustomScript();
      } else {
        console.log('✅ Visualization script already loaded');
        setVisualizationLoaded(true);
      }

      console.log('✅ All scripts loaded successfully');
      
      // Verify script.js functions are available
      console.log('🔍 Post-load function check:', {
        d3: typeof (window as any).d3,
        renderVisualization: typeof (window as any).renderVisualization,
        loadData: typeof (window as any).loadData,
        testDraw: typeof (window as any).testDraw
      });
      
    } catch (error) {
      const errorMsg = `Failed to load visualization scripts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setVisualizationError(errorMsg);
      console.error('❌', errorMsg);
    }
  };

  // Load D3.js from CDN
  const loadD3Script = async (): Promise<void> => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v7.min.js';
      script.async = true;
      
      script.onload = () => {
        console.log('✅ D3.js loaded from CDN');
        setD3Loaded(true);
        resolve();
      };
      
      script.onerror = () => {
        console.warn('⚠️ Failed to load D3.js from CDN, continuing without it');
        setD3Loaded(false);
        resolve(); // Continue even if D3 fails
      };
      
      document.head.appendChild(script);
    });
  };

  // Load custom script.js
  const loadCustomScript = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'visualization-script';
      script.src = '/script.js';
      script.async = true;
      
      console.log('🔍 Loading script from:', script.src);
      console.log('🔍 Current base URL:', window.location.href);
      
      script.onload = () => {
        console.log('✅ Visualization script loaded');
        setVisualizationLoaded(true);
        
        // Verify functions are available
        const testDraw = (window as any).testDraw;
        const renderVisualization = (window as any).renderVisualization;
        const loadData = (window as any).loadData;
        
        console.log('🔍 Available functions:', {
          testDraw: typeof testDraw,
          renderVisualization: typeof renderVisualization,
          loadData: typeof loadData,
          d3: typeof (window as any).d3
        });
        
        // Test script.js execution by calling a simple function
        if (typeof testDraw === 'function') {
          console.log('🧪 Testing script.js execution...');
          try {
            // Don't actually call testDraw here, just verify it exists
            console.log('✅ script.js functions are callable');
          } catch (testError) {
            console.warn('⚠️ Script functions exist but may have issues:', testError);
          }
        }
        
        resolve();
      };
      
      script.onerror = (error) => {
        const errorMsg = 'Failed to load visualization script';
        setVisualizationError(errorMsg);
        console.error('❌', errorMsg, error);
        console.error('🔍 Script src was:', script.src);
        console.error('🔍 Current location:', window.location.href);
        
        // Try to fetch the script manually to see what's happening
        fetch('/script.js')
          .then(response => {
            console.log('🔍 Manual fetch response status:', response.status);
            console.log('🔍 Manual fetch response headers:', response.headers);
            return response.text();
          })
          .then(text => {
            console.log('🔍 Manual fetch response text length:', text.length);
            console.log('🔍 Manual fetch response start:', text.substring(0, 200));
            console.log('🔍 Script contains testDraw?', text.includes('testDraw'));
            console.log('🔍 Script contains renderVisualization?', text.includes('renderVisualization'));
          })
          .catch(fetchError => {
            console.error('🔍 Manual fetch failed:', fetchError);
          });
        
        reject(new Error(errorMsg));
      };
      
      document.head.appendChild(script);
    });
  };

  // Execute visualization with data
  const executeVisualization = (data?: any) => {
    console.log('🎨 Executing visualization with data:', data);
    console.log('🔍 Data type check:', typeof data, data);
    
    // Enhanced data validation
    if (!data) {
      console.warn('⚠️ No data provided for visualization');
      setVisualizationError('No data available for visualization');
      return;
    }

    // Check for various data formats from the new pipeline
    const hasValidData = (
      data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0
    ) || (
      data.analysis?.blocks && Array.isArray(data.analysis.blocks) && data.analysis.blocks.length > 0
    ) || (
      data.ast && Array.isArray(data.ast) && data.ast.length > 0
    ) || (
      data.analysis?.ast && Array.isArray(data.analysis.ast) && data.analysis.ast.length > 0
    );

    if (!hasValidData) {
      console.warn('⚠️ Data exists but no valid blocks or AST found:', data);
      console.log('🔄 Attempting visualization with available data anyway...');
      // Don't return here, let's try to visualize what we have
    } else {
      console.log('✅ Valid data found for visualization');
    }
    
    // Check if we're on the visualization tab
    if (activeTab !== 'visualize') {
      console.log('🔄 Switching to visualization tab first');
      setActiveTab('visualize');
      // Retry after tab switch
      setTimeout(() => executeVisualization(data), 200);
      return;
    }

    // **IMPROVED CONTAINER DETECTION**: Use more reliable approach
    if (!visualizationContainerRef.current) {
      console.warn('⚠️ Container ref not ready, scheduling retry...');
      setTimeout(() => executeVisualization(data), 100);
      return;
    }

    try {
      console.log('🏗️ Container found, starting DOM creation...');
      console.log('🔍 Container element:', visualizationContainerRef.current);
      
      // Clear previous content
      visualizationContainerRef.current.innerHTML = '';
      
      // Create the DOM structure that script.js expects
      createVisualizationDOM();
      
      // Verify DOM was created
      const svgElement = document.getElementById('main-svg');
      console.log('🔍 SVG element after DOM creation:', svgElement);
      
      // Prepare visualization data
      const visualizationData = prepareVisualizationData(data);
      
      // Give DOM time to be ready, then execute visualization
      setTimeout(() => {
        console.log('🎯 About to call visualization functions...');
        console.log('🔍 Available window functions:', {
          renderVisualization: typeof (window as any).renderVisualization,
          loadData: typeof (window as any).loadData,
          testDraw: typeof (window as any).testDraw,
          d3: typeof (window as any).d3
        });
        
        // Execute visualization functions with enhanced error handling
        try {
          if (typeof (window as any).renderVisualization === 'function' && visualizationData) {
            console.log('🎯 Calling renderVisualization with prepared data');
            (window as any).renderVisualization(visualizationData);
            console.log('✅ renderVisualization call completed');
          } else if (typeof (window as any).loadData === 'function') {
            console.log('🎯 Calling loadData function');
            (window as any).loadData(visualizationData);
            console.log('✅ loadData call completed');
          } else if (typeof (window as any).testDraw === 'function') {
            console.log('🧪 Calling testDraw function as fallback');
            (window as any).testDraw();
            console.log('✅ testDraw call completed');
          } else {
            console.warn('⚠️ No visualization functions available, creating fallback');
            createFallbackVisualization();
          }
          
          // Verify something was rendered
          setTimeout(() => {
            const svgContent = document.querySelector('#main-svg *');
            if (svgContent) {
              console.log('✅ Visualization content detected in SVG');
              setVisualizationError(''); // Clear any previous errors
            } else {
              console.warn('⚠️ No content found in SVG after rendering');
              setVisualizationError('Visualization completed but no content rendered');
            }
          }, 500);
          
        } catch (renderError) {
          console.error('💥 Error during visualization function call:', renderError);
          setVisualizationError(`Visualization function error: ${renderError instanceof Error ? renderError.message : 'Unknown error'}`);
          // Try fallback
          createFallbackVisualization();
        }
      }, 100);
      
    } catch (error) {
      console.error('💥 Visualization execution error:', error);
      setVisualizationError(`Visualization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Prepare data for visualization with proper structure
  const prepareVisualizationData = (rawData: any) => {
    console.log('📊 Preparing visualization data from:', rawData);
    
    // Handle different data formats from the new pipeline
    let preparedData: any = {};
    
    if (rawData?.analysis) {
      // Data wrapped in analysis object
      preparedData = {
        ast: rawData.analysis.ast || [],
        functions: rawData.analysis.functions || {},
        classes: rawData.analysis.classes || {},
        blocks: rawData.analysis.blocks || createSemanticBlocks(rawData.analysis)
      };
    } else if (rawData?.blocks || rawData?.ast) {
      // Direct data from new pipeline
      preparedData = {
        ast: rawData.ast || [],
        functions: rawData.functions || {},
        classes: rawData.classes || {},
        blocks: rawData.blocks || createSemanticBlocks(rawData)
      };
    } else {
      // Fallback data structure
      console.warn('⚠️ Unknown data format, using fallback structure');
      preparedData = {
        ast: [],
        functions: {},
        classes: {},
        blocks: []
      };
    }
    
    // Transform blocks into the format expected by script.js
    const transformedBlocks = transformBlocksForVisualization(preparedData.blocks);
    
    console.log('📈 Prepared visualization data:', preparedData);
    console.log('🔄 Transformed blocks for script.js:', transformedBlocks);
    return transformedBlocks;
  };

  // Transform blocks into the format expected by script.js
  const transformBlocksForVisualization = (blocks: any[]) => {
    const transformedData: any[] = [];
    
    console.log('🔄 Transforming blocks for visualization:', blocks);
    
    if (!Array.isArray(blocks) || blocks.length === 0) {
      console.warn('⚠️ No blocks to transform, creating sample data');
      // Create sample data for testing
      return [
        {
          type: "declaration",
          declarations: [
            { name: "x", value: 10, type: "variable", scope: "main" },
            { name: "y", value: 20, type: "variable", scope: "main" }
          ]
        }
      ];
    }
    
    // Group blocks by type and create declarations
    const declarations: any[] = [];
    
    blocks.forEach((block, index) => {
      const blockType = block.type || 'code_block';
      const blockName = block.name || block.id || `block_${index}`;
      
      switch (blockType) {
        case 'class':
          // Add class declaration
          transformedData.push({
            type: "class_declaration",
            name: blockName,
            line: block.start_line || block.line_range?.[0] || 1,
            members: []
          });
          break;
          
        case 'function':
        case 'main_function':
          // Add function declaration
          transformedData.push({
            type: blockType === 'main_function' ? "the standard Main_Function " : "function declaration",
            name: blockName,
            line: block.start_line || block.line_range?.[0] || 1,
            params: [],
            body: []
          });
          break;
          
        case 'variable':
          // Add variable declaration
          declarations.push({
            name: blockName,
            value: null,
            type: "variable",
            scope: "main"
          });
          break;
          
        default:
          // For other block types, create a generic declaration
          declarations.push({
            name: blockName,
            value: `Block(${blockType})`,
            type: "variable",
            scope: "main"
          });
      }
    });
    
    // Add all collected declarations as a single declaration node
    if (declarations.length > 0) {
      transformedData.push({
        type: "declaration",
        declarations: declarations
      });
    }
    
    // If no data was transformed, add a sample
    if (transformedData.length === 0) {
      transformedData.push({
        type: "declaration",
        declarations: [
          { name: "sample", value: "No data", type: "variable", scope: "main" }
        ]
      });
    }
    
    console.log('✅ Transformation complete:', transformedData);
    return transformedData;
  };

  // Create semantic blocks from analysis data  
  const createSemanticBlocks = (analysisData: any) => {
    const blocks: any[] = [];
    
    if (!analysisData) return blocks;
    
    // Process AST to create semantic blocks
    const ast = analysisData.ast || [];
    
    ast.forEach((node: any, index: number) => {
      if (!node || typeof node !== 'object') return;
      
      const nodeType = node.type;
      
      switch (nodeType) {
        case 'class_declaration':
          blocks.push({
            name: node.name || `Class_${index}`,
            type: 'class',
            lines: [node.line || 1, (node.line || 1) + 10],
            members: node.members || [],
            semantic: true
          });
          break;
          
        case 'function declaration':
        case 'the standard Main_Function ':
          blocks.push({
            name: node.name || `Function_${index}`,
            type: nodeType === 'the standard Main_Function ' ? 'main_function' : 'function',
            lines: [node.line || 1, (node.line || 1) + 5],
            return_type: node.return_type,
            params: node.params || [],
            semantic: true
          });
          break;
          
        case 'declaration':
          node.declarations?.forEach((decl: any, declIndex: number) => {
            blocks.push({
              name: decl.name || `Variable_${index}_${declIndex}`,
              type: 'variable',
              data_type: node.data_type,
              lines: [node.line || 1, node.line || 1],
              semantic: true
            });
          });
          break;
      }
    });
    
    // If no semantic blocks were created, create a summary block
    if (blocks.length === 0) {
      blocks.push({
        name: 'Code_Summary',
        type: 'summary',
        lines: [1, 10],
        content: 'Code analysis completed',
        semantic: false
      });
    }
    
    console.log(`📦 Created ${blocks.length} semantic blocks`);
    return blocks;
  };

  // Create DOM structure for visualization
  const createVisualizationDOM = () => {
    if (!visualizationContainerRef.current) return;

    const container = visualizationContainerRef.current;
    
    console.log('🏗️ Creating visualization DOM structure...');
    console.log('📐 Container dimensions:', {
      width: container.clientWidth,
      height: container.clientHeight,
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight
    });
    
    // **COMPLETE CLEANUP**: Remove any existing content first
    container.innerHTML = '';
    
    // Reset visualization state if function is available
    if (typeof (window as any).resetVisualization === 'function') {
      console.log('🔄 Calling resetVisualization for clean state');
      (window as any).resetVisualization();
    }
    
    // Main container with enhanced styling for dark theme
    const mainDiv = document.createElement('div');
    mainDiv.id = 'visualization-main';
    mainDiv.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 500px;
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
      color: #ffffff;
      position: relative;
      border-radius: 8px;
      border: 1px solid #3e3e42;
      overflow: hidden;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    // SVG container with proper scrolling
    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = `
      flex: 1;
      overflow: auto;
      position: relative;
      min-height: 400px;
      background: #1e1e1e;
      border-radius: 8px 8px 0 0;
    `;
    
    // Create SVG element with enhanced sizing and responsive design
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'main-svg';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 1200 600'); // Default viewBox, will be updated dynamically
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet'); // Better responsive scaling
    svg.style.cssText = `
      width: 100%;
      height: 100%;
      min-width: 1200px;
      min-height: 600px;
      background: #1e1e1e;
      display: block;
      border-radius: 8px 8px 0 0;
    `;
    
    svgContainer.appendChild(svg);
    
    // Enhanced control panel with better styling
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    controlPanel.style.cssText = `
      padding: 12px 16px;
      background: #2d2d30;
      border-top: 1px solid #3e3e42;
      display: flex;
      gap: 12px;
      align-items: center;
      border-radius: 0 0 8px 8px;
      flex-shrink: 0;
      box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
    `;
    
    // Enhanced navigation buttons with better styling
    const backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.textContent = '← Previous';
    backBtn.style.cssText = `
      padding: 8px 16px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
    `;
    
    // Enhanced hover effects
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = '#0086e6';
      backBtn.style.transform = 'translateY(-1px)';
    });
    
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = '#007acc';
      backBtn.style.transform = 'translateY(0)';
    });
    
    // Add click handler for DOM button
    backBtn.addEventListener('click', () => {
      console.log('🔙 DOM Previous button clicked');
      handlePreviousStep();
    });
    
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextBtn';
    nextBtn.textContent = 'Next →';
    nextBtn.style.cssText = `
      padding: 8px 16px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
    `;
    
    // Enhanced hover effects
    nextBtn.addEventListener('mouseenter', () => {
      nextBtn.style.background = '#0086e6';
      nextBtn.style.transform = 'translateY(-1px)';
    });
    
    nextBtn.addEventListener('mouseleave', () => {
      nextBtn.style.background = '#007acc';
      nextBtn.style.transform = 'translateY(0)';
    });
    
    // Add click handler for DOM button
    nextBtn.addEventListener('click', () => {
      console.log('🔜 DOM Next button clicked');
      handleNextStep();
    });
    
    // Enhanced step info with better styling
    const stepInfo = document.createElement('span');
    stepInfo.id = 'step-info';
    stepInfo.style.cssText = `
      margin-left: auto;
      font-size: 13px;
      color: #cccccc;
      font-weight: 500;
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    stepInfo.textContent = 'Step: 0/0';
    
    controlPanel.appendChild(backBtn);
    controlPanel.appendChild(nextBtn);
    controlPanel.appendChild(stepInfo);
    
    // Enhanced stack section with better positioning and styling
    const stackSection = document.createElement('div');
    stackSection.id = 'stack-section';
    stackSection.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      width: 220px;
      max-height: 400px;
      overflow-y: auto;
      background: rgba(45, 45, 48, 0.95);
      border: 1px solid #3e3e42;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Cascadia Code', 'Courier New', monospace;
      font-size: 12px;
      z-index: 20;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    svgContainer.appendChild(stackSection);
    mainDiv.appendChild(svgContainer);
    mainDiv.appendChild(controlPanel);
    container.appendChild(mainDiv);
    
    console.log('✅ Created enhanced visualization DOM structure');
    console.log('📏 SVG element configuration:', {
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      viewBox: svg.getAttribute('viewBox'),
      preserveAspectRatio: svg.getAttribute('preserveAspectRatio')
    });
  };

  // Create fallback visualization when scripts aren't available
  const createFallbackVisualization = () => {
    if (!visualizationContainerRef.current) return;

    const container = visualizationContainerRef.current;
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 400px;
      background: #1e1e1e;
      color: #d4d4d4;
      border: 1px solid #3e3e42;
      border-radius: 8px;
      text-align: center;
      padding: 20px;
    `;
    
    fallbackDiv.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 16px;">⚠️</div>
      <h3 style="margin: 0 0 16px 0; color: #ffa500;">Visualization Not Available</h3>
      <p style="margin: 0 0 16px 0; color: #858585;">D3.js or visualization script could not be loaded.</p>
      <div style="background: #2d2d30; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px;">
        D3.js: ${d3Loaded ? '✅ Loaded' : '❌ Not loaded'}<br>
        Script.js: ${visualizationLoaded ? '✅ Loaded' : '❌ Not loaded'}
      </div>
    `;
    
    container.appendChild(fallbackDiv);
  };

  // Load script on component mount
  useEffect(() => {
    loadVisualizationScript();
  }, []);

  // Execute visualization when tab becomes active and data is available
  useEffect(() => {
    if (activeTab === 'visualize' && visualizationLoaded) {
      console.log('📋 Tab switched to visualize, executing visualization...');
      console.log('🔍 Container ref status:', {
        current: visualizationContainerRef.current,
        exists: !!visualizationContainerRef.current,
        hasAnalysisData: !!analysisData?.analysis
      });
      
      setTimeout(() => {
        executeVisualization(analysisData?.analysis);
      }, 100);
    }
  }, [activeTab, visualizationLoaded, analysisData]);

  // **CONTAINER REF DETECTION**: Auto-trigger visualization when container becomes available
  useEffect(() => {
    if (visualizationContainerRef.current && activeTab === 'visualize' && visualizationLoaded && analysisData) {
      console.log('🎯 Container ref detected, auto-triggering visualization...');
      console.debug('containerRef:', visualizationContainerRef.current);
      executeVisualization(analysisData.analysis || analysisData);
    }
  }, [visualizationContainerRef.current, activeTab, visualizationLoaded, analysisData]);

  // Switch to appropriate tab when new data arrives
  useEffect(() => {
    if (isDebugging) {
      setActiveTab('debug');
    } else if (compilationData) {
      setActiveTab('compilation');
    } else if (analysisData) {
      setActiveTab('blocks');
    }
  }, [analysisData, compilationData, isDebugging]);

  // **ZOOM RESET**: Reset zoom when switching away from visualize tab
  useEffect(() => {
    if (activeTab !== 'visualize' && zoomLevel !== 1.0) {
      console.log('🔄 Resetting zoom level when leaving visualize tab');
      setZoomLevel(1.0);
    }
  }, [activeTab, zoomLevel]);

  // Debug container mounting
  useEffect(() => {
    console.log('🎯 VisualizationPanel mounted, container ref:', {
      current: visualizationContainerRef.current,
      activeTab: activeTab
    });
  }, []);

  // Enhanced data access functions that handle the new pipeline structure
  const getTotalBlocks = () => {
    return analysisData?.summary?.total_blocks ?? 
           analysisData?.blocks?.length ?? 
           analysisData?.analysis?.blocks?.length ?? 0;
  };
  
  const getFunctionsCount = () => {
    const functions = analysisData?.functions ?? 
                     analysisData?.analysis?.functions ?? {};
    return Object.keys(functions).length;
  };
  
  const getTokensCount = () => {
    return analysisData?.analysis?.tokens?.length ?? 0;
  };
  
  const getBlocks = () => {
    return analysisData?.blocks ?? 
           analysisData?.analysis?.blocks ?? 
           analysisData?.summary?.blocks ?? [];
  };
  
  const getCompilationSuccess = () => compilationData?.summary?.successful_compilations ?? 0;
  const getCompilationFailed = () => compilationData?.summary?.failed_compilations ?? 0;
  const getIntermediateFiles = () => compilationData?.summary?.intermediate_files ?? [];
  const getCompilationErrors = () => compilationData?.summary?.errors ?? [];

  const renderOverview = () => (
    <div className="overview-content">
      <h3>Code Analysis Overview</h3>
      {analysisData ? (
        <div className="overview-stats">
          <div className="stat-item">
            <span className="stat-label">Total Blocks:</span>
            <span className="stat-value">{getTotalBlocks()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Functions:</span>
            <span className="stat-value">{getFunctionsCount()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Tokens:</span>
            <span className="stat-value">{getTokensCount()}</span>
          </div>
        </div>
      ) : (
        <div className="loading-state">
          <p>Click "Analyze" to start code analysis</p>
        </div>
      )}
      
      {compilationData && (
        <div className="compilation-overview">
          <h4>Compilation Results</h4>
          <div className="overview-stats">
            <div className="stat-item">
              <span className="stat-label">Successful:</span>
              <span className="stat-value success">{getCompilationSuccess()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Failed:</span>
              <span className="stat-value error">{getCompilationFailed()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Intermediate Files:</span>
              <span className="stat-value">{getIntermediateFiles().length}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="script-status">
        <h4>Visualization Status</h4>
        <div className="status-grid">
          <div className={`status-item ${d3Loaded ? 'success' : 'error'}`}>
            <span className="status-icon">{d3Loaded ? '✅' : '❌'}</span>
            <span>D3.js</span>
          </div>
          <div className={`status-item ${visualizationLoaded ? 'success' : 'error'}`}>
            <span className="status-icon">{visualizationLoaded ? '✅' : '❌'}</span>
            <span>Script.js</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBlocks = () => {
    const blocks = getBlocks();
    
    return (
      <div className="blocks-content">
        <h3>Code Blocks</h3>
        {analysisData ? (
          blocks.length > 0 ? (
            <div className="blocks-list">
              {blocks.map((block) => (
                <div 
                  key={block.id} 
                  className={`block-item ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBlock(block)}
                >
                  <div className="block-header">
                    <span className="block-id">{block.id}</span>
                    <span className="block-lines">
                      Lines {block.line_range?.[0] ?? 0}-{block.line_range?.[1] ?? 0}
                    </span>
                  </div>
                  <div className="block-description">{block.description || 'No description'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No code blocks found in analysis</p>
            </div>
          )
        ) : (
          <div className="loading-state">
            <p>Waiting for analysis data...</p>
            <div className="spinner"></div>
          </div>
        )}
        
        {selectedBlock && (
          <div className="block-details">
            <h4>Block Details: {selectedBlock.id}</h4>
            <p>{selectedBlock.description || 'No description available'}</p>
            <pre className="block-code">{selectedBlock.code || '// No code available'}</pre>
          </div>
        )}
      </div>
    );
  };

  const renderCompilation = () => {
    const intermediateFiles = getIntermediateFiles();
    const errors = getCompilationErrors();
    
    return (
      <div className="compilation-content">
        <h3>Compilation Results</h3>
        {compilationData ? (
          <div>
            <div className="compilation-summary">
              <div className="summary-stats">
                <div className="stat success">
                  <span className="stat-number">{getCompilationSuccess()}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat error">
                  <span className="stat-number">{getCompilationFailed()}</span>
                  <span className="stat-label">Failed</span>
                </div>
                <div className="stat info">
                  <span className="stat-number">{intermediateFiles.length}</span>
                  <span className="stat-label">Intermediate Files</span>
                </div>
              </div>
            </div>
            
            {intermediateFiles.length > 0 && (
              <div className="intermediate-files">
                <h4>Generated Intermediate Code</h4>
                {intermediateFiles.map((file, index) => (
                  <div key={index} className="intermediate-file">
                    <div className="file-header">
                      <span className="file-block">{file?.block || `Block ${index + 1}`}</span>
                      <span className="file-lines">{file?.lines || 0} lines</span>
                    </div>
                    <div className="file-path">{file?.file || 'Unknown file'}</div>
                  </div>
                ))}
              </div>
            )}
            
            {errors.length > 0 && (
              <div className="compilation-errors">
                <h4>Compilation Errors</h4>
                {errors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-block">{error?.block || `Block ${index + 1}`}</div>
                    <div className="error-message">{error?.error || 'Unknown error'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="loading-state">
            <p>Waiting for compilation results...</p>
            <div className="spinner"></div>
          </div>
        )}
      </div>
    );
  };

  const renderDebug = () => (
    <div className="debug-content">
      <h3>Debug Information</h3>
      {isDebugging ? (
        <div className="debug-info">
          <div className="debug-status">
            <div className="status-indicator active">
              <span className="indicator-dot"></span>
              <span>Debug Session Active</span>
            </div>
          </div>
          
          <div className="debug-sections">
            <div className="debug-section">
              <h4>Current State</h4>
              <p>Program is running in debug mode</p>
            </div>
            
            <div className="debug-section">
              <h4>Variables</h4>
              <p>Variable tracking will appear here</p>
            </div>
            
            <div className="debug-section">
              <h4>Call Stack</h4>
              <p>Call stack information will appear here</p>
            </div>
            
            <div className="debug-section">
              <h4>Execution Timeline</h4>
              <p>Step-by-step execution flow will appear here</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="loading-state">
          <p>Start debugging to see debug information</p>
        </div>
      )}
    </div>
  );

  const getTabCount = (tabType: string) => {
    switch (tabType) {
      case 'blocks':
        return getTotalBlocks();
      case 'compilation':
        return getCompilationSuccess() + getCompilationFailed();
      default:
        return 0;
    }
  };

  // Handle render button click - trigger parsing and visualization
  const handleRenderVisualization = () => {
    console.log('🎨 Starting render visualization...');
    console.log('📊 Available analysis data:', analysisData);
    
    if (!analysisData) {
      console.warn('⚠️ No analysis data available for visualization');
      setVisualizationError('No analysis data available. Please run code analysis first.');
      return;
    }

    // **ENHANCED DATA STRUCTURE INSPECTION** with detailed logging
    console.log('🔍 Analysis data structure inspection:');
    console.log('  - Type:', typeof analysisData);
    console.log('  - Keys:', Object.keys(analysisData));
    console.log('  - Has blocks:', !!analysisData.blocks);
    console.log('  - Has ast:', !!analysisData.ast);
    console.log('  - Has functions:', !!analysisData.functions);
    
    // Extract visualization data from various possible structures
    let visualizationData = null;
    
    if (analysisData.blocks && Array.isArray(analysisData.blocks)) {
      console.log('📦 Using blocks data for visualization');
      visualizationData = analysisData.blocks;
      console.log(`  - Found ${visualizationData.length} blocks`);
    } else if (analysisData.ast && Array.isArray(analysisData.ast)) {
      console.log('🌳 Using AST data for visualization');
      visualizationData = analysisData.ast;
      console.log(`  - Found ${visualizationData.length} AST nodes`);
    } else if (analysisData.functions && Array.isArray(analysisData.functions)) {
      console.log('🔧 Using functions data for visualization');
      visualizationData = analysisData.functions;
      console.log(`  - Found ${visualizationData.length} functions`);
    } else {
      console.log('📋 Using entire analysis data object');
      visualizationData = analysisData;
    }
    
    // **DETAILED HEAP DATA LOGGING** for debugging linked list issues
    if (Array.isArray(visualizationData)) {
      const heapNodes = visualizationData.filter(node => 
        node && (
          node.type === 'class_pointer_declaration' ||
          node.type === 'member_assignment' ||
          (node.allocation === 'new') ||
          (node.scope === 'heap')
        )
      );
      
      console.log(`🏗️ Found ${heapNodes.length} heap-related nodes:`);
      heapNodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.type} - ${node.name || 'unnamed'}`, {
          allocation: node.allocation,
          class_type: node.class_type,
          scope: node.scope,
          members: node.members
        });
      });
      
      // Look for linked list patterns specifically
      const linkedListNodes = visualizationData.filter(node => 
        node && (
          (node.class_type && node.class_type.toLowerCase().includes('node')) ||
          (node.name && node.name.toLowerCase().includes('node')) ||
          (node.members && node.members.next)
        )
      );
      
      console.log(`🔗 Found ${linkedListNodes.length} potential linked list nodes:`);
      linkedListNodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.name || 'unnamed'} (${node.type})`, {
          class_type: node.class_type,
          members: node.members,
          allocation: node.allocation
        });
      });
    }

    // **COMPLETE STATE RESET** before rendering
    setVisualizationError(''); // Clear previous errors
    
    // Reset visualization state using our new reset function
    if (typeof (window as any).resetVisualization === 'function') {
      console.log('🔄 Resetting visualization state before rendering...');
      (window as any).resetVisualization();
    }

    try {
      // **DOM CREATION WITH CLEANUP**: Create DOM if needed
      if (!document.getElementById('visualization-main')) {
        console.log('🏗️ Creating fresh visualization DOM...');
        createVisualizationDOM();
        
        // Wait for DOM to be fully ready
        setTimeout(() => {
          console.log('🎯 DOM ready, checking script availability...');
          if (typeof (window as any).renderVisualization === 'function') {
            console.log('✅ Script loaded, calling renderVisualization...');
            (window as any).renderVisualization(visualizationData);
            
            // **VERIFICATION**: Check if content was actually rendered
            setTimeout(() => {
              const svgContent = document.querySelector('#main-svg *');
              if (svgContent) {
                console.log('✅ Visualization content successfully rendered');
                setVisualizationError(''); // Success - clear error
              } else {
                console.warn('⚠️ No SVG content found after rendering');
                setVisualizationError('Visualization completed but no content appeared');
              }
            }, 500);
            
          } else {
            console.error('❌ Script not loaded - renderVisualization function not available');
            setVisualizationError('Visualization script not loaded. Try reloading the page.');
          }
        }, 300);
      } else {
        console.log('🎯 DOM exists, clearing and re-rendering...');
        
        // Clear existing content and create fresh DOM
        const container = visualizationContainerRef.current;
        if (container) {
          container.innerHTML = '';
          createVisualizationDOM();
          
          // Wait for DOM recreation
          setTimeout(() => {
            if (typeof (window as any).renderVisualization === 'function') {
              console.log('✅ Calling renderVisualization with data:', visualizationData);
              (window as any).renderVisualization(visualizationData);
              
              // **VERIFICATION**: Check rendering success
              setTimeout(() => {
                const svgContent = document.querySelector('#main-svg *');
                if (svgContent) {
                  console.log('✅ Re-rendering successful');
                  setVisualizationError(''); // Success - clear error
                } else {
                  console.warn('⚠️ Re-rendering failed - no content found');
                  setVisualizationError('Re-rendering failed - please try again');
                }
              }, 500);
              
            } else {
              console.error('❌ renderVisualization function not available');
              setVisualizationError('Visualization script not loaded. Please reload scripts.');
            }
          }, 200);
        }
      }
    } catch (error) {
      console.error('❌ Error during visualization rendering:', error);
      setVisualizationError(`Rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Function to update step info display
  const updateStepInfo = () => {
    // Update DOM step info if available
    const stepInfoElement = document.getElementById('step-info');
    if (stepInfoElement && typeof (window as any).getCurrentStep === 'function') {
      const stepInfo = (window as any).getCurrentStep();
      stepInfoElement.textContent = `Step: ${stepInfo.currentStep}/${stepInfo.totalSteps}`;
    }
  };

  // Navigation handlers for step-based visualization
  const handleNextStep = () => {
    console.log('🔜 Next step requested');
    
    // Call script.js nextStep function if available
    if (typeof (window as any).nextStep === 'function') {
      console.log('🎯 Calling script.js nextStep()');
      (window as any).nextStep();
      setTimeout(updateStepInfo, 100); // Update step info after navigation
    } else if (typeof (window as any).goToNextStep === 'function') {
      console.log('🎯 Calling script.js goToNextStep()');
      (window as any).goToNextStep();
      setTimeout(updateStepInfo, 100);
    } else {
      console.warn('⚠️ No next step function available in script.js');
      setVisualizationError('Navigation functions not available - please reload scripts');
    }
  };

  const handlePreviousStep = () => {
    console.log('🔙 Previous step requested');
    
    // Call script.js prevStep function if available
    if (typeof (window as any).prevStep === 'function') {
      console.log('🎯 Calling script.js prevStep()');
      (window as any).prevStep();
      setTimeout(updateStepInfo, 100); // Update step info after navigation
    } else if (typeof (window as any).goToPreviousStep === 'function') {
      console.log('🎯 Calling script.js goToPreviousStep()');
      (window as any).goToPreviousStep();
      setTimeout(updateStepInfo, 100);
    } else {
      console.warn('⚠️ No previous step function available in script.js');
      setVisualizationError('Navigation functions not available - please reload scripts');
    }
  };

  // Navigation handler for direct step access (currently unused but available for future use)
  // const handleGoToStep = (stepIndex: number) => {
  //   console.log(`🎯 Go to step ${stepIndex} requested`);
  //   
  //   // Call script.js renderStep function if available
  //   if (typeof (window as any).renderStep === 'function') {
  //     console.log(`🎯 Calling script.js renderStep(${stepIndex})`);
  //     (window as any).renderStep(stepIndex);
  //     setTimeout(updateStepInfo, 100); // Update step info after navigation
  //   } else {
  //     console.warn('⚠️ No renderStep function available in script.js');
  //     setVisualizationError('Step navigation function not available - please reload scripts');
  //   }
  // };

  // Enhanced version that includes a direct test
  const handleTestVisualization = () => {
    console.log('🧪 Testing visualization directly...');
    
    if (activeTab !== 'visualize') {
      setActiveTab('visualize');
      setTimeout(() => handleTestVisualization(), 300);
      return;
    }
    
    // Wait for container
    setTimeout(() => {
      const container = visualizationContainerRef.current;
      if (!container) {
        console.error('❌ Container not found');
        setVisualizationError('Visualization container not found');
        return;
      }
      
      // Clear and create DOM
      container.innerHTML = '';
      createVisualizationDOM();
      
      // Test script functions including navigation
      setTimeout(() => {
        console.log('🔍 Testing script functions:', {
          d3: typeof (window as any).d3,
          testDraw: typeof (window as any).testDraw,
          renderVisualization: typeof (window as any).renderVisualization,
          nextStep: typeof (window as any).nextStep,
          prevStep: typeof (window as any).prevStep,
          goToNextStep: typeof (window as any).goToNextStep,
          goToPreviousStep: typeof (window as any).goToPreviousStep,
          renderStep: typeof (window as any).renderStep
        });
        
        if (typeof (window as any).testDraw === 'function') {
          console.log('🎯 Calling testDraw...');
          (window as any).testDraw();
          setVisualizationError('');
          
          // Test navigation functions
          setTimeout(() => {
            console.log('🔍 Navigation functions test:');
            console.log('  - nextStep available:', typeof (window as any).nextStep === 'function');
            console.log('  - prevStep available:', typeof (window as any).prevStep === 'function');
          }, 1000);
        } else {
          console.error('❌ testDraw function not available');
          setVisualizationError('Test function not available - script loading issue');
          createFallbackVisualization();
        }
      }, 200);
    }, 100);
  };

  // Listen for parse-complete events
  useEffect(() => {
    const handleParseComplete = (data: { dataPath: string }) => {
      console.log('🎯 Parse complete received:', data);
      
      // Load the generated data.json and trigger visualization
      fetch('/data/data.json')
        .then(response => response.json())
        .then(jsonData => {
          console.log('📊 Loaded visualization data:', jsonData);
          executeVisualization(jsonData);
        })
        .catch(error => {
          console.error('❌ Failed to load visualization data:', error);
          setVisualizationError(`Failed to load visualization data: ${error.message}`);
        });
    };

    // Register the callback
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.onParseComplete(handleParseComplete);
      
      // Cleanup on unmount
      return () => {
        (window as any).electronAPI.offParseComplete(handleParseComplete);
      };
    }
  }, []);

  return (
    <div className="visualization-panel">
      <div className="panel-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
          disabled={!analysisData}
        >
          Blocks ({getTabCount('blocks')})
        </button>
        <button 
          className={`tab ${activeTab === 'compilation' ? 'active' : ''}`}
          onClick={() => setActiveTab('compilation')}
          disabled={!compilationData}
        >
          Compilation
        </button>
        <button 
          className={`tab ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveTab('debug')}
        >
          Debug {isDebugging && <span className="debug-indicator">●</span>}
        </button>
        <button 
          className={`tab ${activeTab === 'visualize' ? 'active' : ''}`}
          onClick={() => setActiveTab('visualize')}
        >
          Visualize {visualizationLoaded && <span className="loaded-indicator">●</span>}
        </button>
      </div>
      
      <div className="panel-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'blocks' && renderBlocks()}
        {activeTab === 'compilation' && renderCompilation()}
        {activeTab === 'debug' && renderDebug()}
        {activeTab === 'visualize' && (
          <div className="visualize-content">
            <div className="visualize-header">
              <h3>C++ Memory Visualization</h3>
              <div className="control-buttons">
                <button 
                  onClick={handleRenderVisualization}
                  className="render-button"
                  disabled={!visualizationLoaded || !analysisData}
                >
                  🎨 Render Data
                </button>
                <button 
                  onClick={handleTestVisualization}
                  className="test-button"
                >
                  🧪 Test Visualization
                </button>
                <button 
                  onClick={loadVisualizationScript}
                  className="reload-button"
                >
                  🔄 Reload Scripts
                </button>
                {/* **ZOOM CONTROLS**: UI buttons for zoom functionality */}
                <div className="zoom-controls" style={{
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                  marginLeft: '8px',
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.3))}
                    disabled={zoomLevel <= 0.3}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: zoomLevel <= 0.3 ? '#555' : '#007acc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: zoomLevel <= 0.3 ? 'not-allowed' : 'pointer'
                    }}
                    title="Zoom Out (Ctrl + -)"
                  >
                    🔍-
                  </button>
                  <span style={{
                    fontSize: '11px',
                    color: '#cccccc',
                    minWidth: '40px',
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    {(zoomLevel * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(1.0)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: zoomLevel === 1.0 ? '#28a745' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Reset Zoom (Ctrl + 0)"
                  >
                    1:1
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3.0))}
                    disabled={zoomLevel >= 3.0}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: zoomLevel >= 3.0 ? '#555' : '#007acc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: zoomLevel >= 3.0 ? 'not-allowed' : 'pointer'
                    }}
                    title="Zoom In (Ctrl + +)"
                  >
                    🔍+
                  </button>
                </div>
              </div>
            </div>
            
            {/* **KEYBOARD SHORTCUTS HELP**: Show available shortcuts */}
            <div className="shortcuts-help" style={{
              display: 'flex',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: '#2d2d30',
              borderRadius: '6px',
              margin: '8px 0',
              fontSize: '11px',
              color: '#858585',
              alignItems: 'center',
              border: '1px solid #3e3e42'
            }}>
              <span style={{ fontWeight: '600', color: '#cccccc' }}>⌨️ Shortcuts:</span>
              <span><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl + +</code> Zoom In</span>
              <span><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl + -</code> Zoom Out</span>
              <span><code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl + 0</code> Reset Zoom</span>
              <span style={{ marginLeft: 'auto', color: '#666' }}>Current: {(zoomLevel * 100).toFixed(0)}%</span>
            </div>
            
            {/* Navigation Controls */}
            <div className="navigation-controls" style={{
              display: 'flex',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#2d2d30',
              borderRadius: '6px',
              margin: '8px 0',
              alignItems: 'center'
            }}>
              <button 
                onClick={handlePreviousStep}
                disabled={!visualizationLoaded}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ← Previous Step
              </button>
              
              <button 
                onClick={handleNextStep}
                disabled={!visualizationLoaded}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Next Step →
              </button>
              
              <span style={{
                marginLeft: 'auto',
                fontSize: '12px',
                color: '#858585'
              }}>
                React Navigation Controls
              </span>
            </div>
            
            <div className="visualize-container" ref={visualizationContainerRef}></div>
            {visualizationError && (
              <div className="error-state">
                <p style={{ color: '#f44336', margin: '16px 0' }}>{visualizationError}</p>
                <button 
                  onClick={() => {
                    setVisualizationError('');
                    loadVisualizationScript();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#007acc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Retry Loading
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizationPanel; 