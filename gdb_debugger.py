#!/usr/bin/env python3
"""
GDB Debugger Integration for C++ Code Visualization
Provides real-time debugging with breakpoints and variable tracking
"""

import sys
import os
import subprocess
import json
import threading
import time
import re
from pathlib import Path
import tempfile
import signal

class GDBDebugger:
    def __init__(self):
        self.gdb_process = None
        self.is_running = False
        self.breakpoints = {}
        self.variables = {}
        self.execution_flow = []
        self.current_line = 0
        self.output_callback = None
        self.debug_info = {
            'breakpoints': [],
            'variables': {},
            'execution_timeline': [],
            'current_state': 'stopped'
        }
        
    def set_output_callback(self, callback):
        """Set callback function for real-time output"""
        self.output_callback = callback
        
    def send_output(self, message, msg_type="info"):
        """Send output to callback or print"""
        output = {
            'type': msg_type,
            'message': message,
            'timestamp': time.time()
        }
        
        if self.output_callback:
            self.output_callback(output)
        else:
            print(f"[{msg_type.upper()}] {message}")
    
    def compile_for_debugging(self, cpp_file, output_file=None):
        """Compile C++ file with debugging symbols"""
        if not output_file:
            output_file = cpp_file.replace('.cpp', '_debug')
        
        compile_cmd = [
            'g++',
            '-g',          # Include debugging information
            '-O0',         # No optimization for easier debugging
            '-o', output_file,
            cpp_file
        ]
        
        try:
            result = subprocess.run(compile_cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                self.send_output(f"Compilation failed: {result.stderr}", "error")
                return None
            
            self.send_output(f"Successfully compiled {cpp_file} for debugging", "success")
            return output_file
            
        except Exception as e:
            self.send_output(f"Compilation error: {e}", "error")
            return None
    
    def start_gdb_session(self, executable_file, breakpoints=None):
        """Start GDB debugging session"""
        try:
            # Start GDB with the executable
            self.gdb_process = subprocess.Popen(
                ['gdb', '--interpreter=mi', executable_file],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            self.is_running = True
            self.send_output("GDB session started", "success")
            
            # Set up breakpoints if provided
            if breakpoints:
                for bp in breakpoints:
                    self.set_breakpoint(bp['file'], bp['line'])
            
            # Start output monitoring thread
            self.output_thread = threading.Thread(target=self.monitor_gdb_output)
            self.output_thread.daemon = True
            self.output_thread.start()
            
            return True
            
        except Exception as e:
            self.send_output(f"Failed to start GDB: {e}", "error")
            return False
    
    def monitor_gdb_output(self):
        """Monitor GDB output in real-time"""
        while self.is_running and self.gdb_process:
            try:
                line = self.gdb_process.stdout.readline()
                if not line:
                    break
                
                self.process_gdb_output(line.strip())
                
            except Exception as e:
                self.send_output(f"Error monitoring GDB output: {e}", "error")
                break
    
    def process_gdb_output(self, line):
        """Process and interpret GDB output"""
        if not line:
            return
        
        # Parse GDB/MI output format
        if line.startswith('*stopped'):
            self.handle_stopped_event(line)
        elif line.startswith('*running'):
            self.handle_running_event(line)
        elif line.startswith('&"'):
            # GDB console output
            message = line[2:-1].replace('\\"', '"')
            self.send_output(message, "gdb")
        elif line.startswith('~"'):
            # Target output
            message = line[2:-1].replace('\\"', '"')
            self.send_output(message, "target")
        elif line.startswith('^done'):
            # Command completed successfully
            self.handle_command_done(line)
        elif line.startswith('^error'):
            # Command failed
            error_msg = self.extract_error_message(line)
            self.send_output(f"GDB Error: {error_msg}", "error")
    
    def handle_stopped_event(self, line):
        """Handle when program execution stops"""
        self.debug_info['current_state'] = 'stopped'
        
        # Extract reason for stopping
        if 'reason="breakpoint-hit"' in line:
            self.handle_breakpoint_hit(line)
        elif 'reason="end-stepping-range"' in line:
            self.handle_step_complete(line)
        elif 'reason="exited-normally"' in line:
            self.handle_program_exit(line)
        
        # Get current location
        self.get_current_location()
        self.get_local_variables()
    
    def handle_running_event(self, line):
        """Handle when program starts running"""
        self.debug_info['current_state'] = 'running'
        self.send_output("Program running...", "info")
    
    def handle_breakpoint_hit(self, line):
        """Handle breakpoint hit"""
        # Extract breakpoint info
        bp_match = re.search(r'bkptno="(\d+)"', line)
        if bp_match:
            bp_id = bp_match.group(1)
            self.send_output(f"Breakpoint {bp_id} hit", "breakpoint")
            
            # Add to execution timeline
            self.execution_flow.append({
                'type': 'breakpoint',
                'breakpoint_id': bp_id,
                'timestamp': time.time()
            })
    
    def handle_step_complete(self, line):
        """Handle single step completion"""
        self.send_output("Step completed", "info")
        
        self.execution_flow.append({
            'type': 'step',
            'timestamp': time.time()
        })
    
    def handle_program_exit(self, line):
        """Handle program exit"""
        self.send_output("Program exited normally", "success")
        self.debug_info['current_state'] = 'exited'
    
    def extract_error_message(self, line):
        """Extract error message from GDB error output"""
        match = re.search(r'msg="([^"]*)"', line)
        return match.group(1) if match else "Unknown error"
    
    def send_gdb_command(self, command):
        """Send command to GDB"""
        if not self.gdb_process or not self.is_running:
            return False
        
        try:
            self.gdb_process.stdin.write(command + '\n')
            self.gdb_process.stdin.flush()
            return True
        except Exception as e:
            self.send_output(f"Failed to send command: {e}", "error")
            return False
    
    def set_breakpoint(self, file_path, line_number):
        """Set breakpoint at specific line"""
        command = f'-break-insert {file_path}:{line_number}'
        
        if self.send_gdb_command(command):
            bp_id = len(self.breakpoints) + 1
            self.breakpoints[bp_id] = {
                'file': file_path,
                'line': line_number,
                'id': bp_id
            }
            
            self.debug_info['breakpoints'].append({
                'id': bp_id,
                'file': file_path,
                'line': line_number,
                'enabled': True
            })
            
            self.send_output(f"Breakpoint set at {file_path}:{line_number}", "success")
            return bp_id
        
        return None
    
    def remove_breakpoint(self, bp_id):
        """Remove breakpoint"""
        command = f'-break-delete {bp_id}'
        
        if self.send_gdb_command(command):
            if bp_id in self.breakpoints:
                del self.breakpoints[bp_id]
            
            # Update debug info
            self.debug_info['breakpoints'] = [
                bp for bp in self.debug_info['breakpoints'] if bp['id'] != bp_id
            ]
            
            self.send_output(f"Breakpoint {bp_id} removed", "success")
            return True
        
        return False
    
    def run_program(self):
        """Start program execution"""
        self.send_gdb_command('-exec-run')
        self.send_output("Starting program execution", "info")
    
    def continue_execution(self):
        """Continue program execution"""
        self.send_gdb_command('-exec-continue')
        self.send_output("Continuing execution", "info")
    
    def step_over(self):
        """Step over current line"""
        self.send_gdb_command('-exec-next')
        self.send_output("Stepping over", "info")
    
    def step_into(self):
        """Step into function call"""
        self.send_gdb_command('-exec-step')
        self.send_output("Stepping into", "info")
    
    def step_out(self):
        """Step out of current function"""
        self.send_gdb_command('-exec-finish')
        self.send_output("Stepping out", "info")
    
    def get_current_location(self):
        """Get current execution location"""
        self.send_gdb_command('-stack-info-frame')
    
    def get_local_variables(self):
        """Get local variables and their values"""
        self.send_gdb_command('-stack-list-variables --simple-values')
    
    def get_call_stack(self):
        """Get current call stack"""
        self.send_gdb_command('-stack-list-frames')
    
    def evaluate_expression(self, expression):
        """Evaluate expression in current context"""
        command = f'-data-evaluate-expression {expression}'
        self.send_gdb_command(command)
    
    def handle_command_done(self, line):
        """Handle successful command completion"""
        # Extract and process command results
        if 'stack-info-frame' in line:
            self.process_frame_info(line)
        elif 'stack-list-variables' in line:
            self.process_variables_info(line)
        elif 'data-evaluate-expression' in line:
            self.process_expression_result(line)
    
    def process_frame_info(self, line):
        """Process current frame information"""
        # Extract file and line information
        file_match = re.search(r'file="([^"]*)"', line)
        line_match = re.search(r'line="(\d+)"', line)
        
        if file_match and line_match:
            current_file = file_match.group(1)
            current_line = int(line_match.group(1))
            
            self.current_line = current_line
            
            self.send_output(f"Current location: {current_file}:{current_line}", "location")
            
            # Add to execution timeline
            self.execution_flow.append({
                'type': 'location',
                'file': current_file,
                'line': current_line,
                'timestamp': time.time()
            })
    
    def process_variables_info(self, line):
        """Process local variables information"""
        # This would need more sophisticated parsing for real variable data
        # For now, just notify that variables were updated
        self.send_output("Local variables updated", "variables")
    
    def process_expression_result(self, line):
        """Process expression evaluation result"""
        value_match = re.search(r'value="([^"]*)"', line)
        if value_match:
            result = value_match.group(1)
            self.send_output(f"Expression result: {result}", "result")
    
    def stop_debugging(self):
        """Stop debugging session"""
        self.is_running = False
        
        if self.gdb_process:
            try:
                self.send_gdb_command('-gdb-exit')
                self.gdb_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.gdb_process.kill()
            finally:
                self.gdb_process = None
        
        self.send_output("Debugging session ended", "info")
    
    def get_debug_summary(self):
        """Get complete debugging session summary"""
        return {
            'debug_info': self.debug_info,
            'execution_flow': self.execution_flow,
            'variables': self.variables,
            'breakpoints': self.breakpoints
        }
    
    def save_debug_session(self, output_file):
        """Save debugging session data to file"""
        summary = self.get_debug_summary()
        
        with open(output_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.send_output(f"Debug session saved to {output_file}", "success")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 gdb_debugger.py <cpp_file> [breakpoints_file]")
        sys.exit(1)
    
    cpp_file = sys.argv[1]
    breakpoints_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(cpp_file):
        print(f"Error: File {cpp_file} not found")
        sys.exit(1)
    
    debugger = GDBDebugger()
    
    # Compile for debugging
    executable = debugger.compile_for_debugging(cpp_file)
    if not executable:
        sys.exit(1)
    
    # Load breakpoints if file provided
    breakpoints = []
    if breakpoints_file and os.path.exists(breakpoints_file):
        with open(breakpoints_file, 'r') as f:
            breakpoints = json.load(f)
    
    # Start debugging session
    if debugger.start_gdb_session(executable, breakpoints):
        print("GDB session started. Available commands:")
        print("  run - Start program execution")
        print("  continue - Continue execution")
        print("  step - Step over")
        print("  stepi - Step into")
        print("  finish - Step out")
        print("  break <file>:<line> - Set breakpoint")
        print("  delete <bp_id> - Remove breakpoint")
        print("  print <expr> - Evaluate expression")
        print("  quit - Exit debugger")
        
        try:
            # Interactive debugging loop
            while debugger.is_running:
                try:
                    cmd = input("(gdb) ").strip()
                    
                    if cmd == "quit":
                        break
                    elif cmd == "run":
                        debugger.run_program()
                    elif cmd == "continue":
                        debugger.continue_execution()
                    elif cmd == "step":
                        debugger.step_over()
                    elif cmd == "stepi":
                        debugger.step_into()
                    elif cmd == "finish":
                        debugger.step_out()
                    elif cmd.startswith("break "):
                        parts = cmd.split()
                        if len(parts) == 2 and ":" in parts[1]:
                            file_line = parts[1].split(":")
                            debugger.set_breakpoint(file_line[0], int(file_line[1]))
                    elif cmd.startswith("delete "):
                        bp_id = int(cmd.split()[1])
                        debugger.remove_breakpoint(bp_id)
                    elif cmd.startswith("print "):
                        expr = cmd[6:]
                        debugger.evaluate_expression(expr)
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Error: {e}")
        
        finally:
            # Save session and cleanup
            debugger.save_debug_session("debug_session.json")
            debugger.stop_debugging()

if __name__ == "__main__":
    main() 