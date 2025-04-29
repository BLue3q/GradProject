#include <emscripten.h>
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <cstdlib>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    const char* compile_and_run(const char* code) {
        try {
            // Create a temporary file
            std::string filename = "temp.cpp";
            std::ofstream file(filename);
            file << code;
            file.close();

            // Compile the code
            std::string command = "g++ " + filename + " -o temp.out 2>&1";
            FILE* pipe = popen(command.c_str(), "r");
            if (!pipe) {
                return "Failed to execute compilation command";
            }

            char buffer[128];
            std::string result = "";
            while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
                result += buffer;
            }
            pclose(pipe);

            // If there were compilation errors, return them
            if (!result.empty()) {
                return result.c_str();
            }

            // Run the compiled program
            command = "./temp.out 2>&1";
            pipe = popen(command.c_str(), "r");
            if (!pipe) {
                return "Failed to execute program";
            }

            result = "";
            while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
                result += buffer;
            }
            pclose(pipe);

            // Clean up
            std::remove(filename.c_str());
            std::remove("temp.out");

            // Return the output
            return result.c_str();
        } catch (const std::exception& e) {
            return e.what();
        }
    }
} 