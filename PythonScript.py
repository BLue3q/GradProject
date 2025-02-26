import json
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

def load_and_visualize(json_file="output.json"):
    with open(json_file, "r") as f:
        data = json.load(f)
    
    variables = data["variables"]
    
    # Create a figure and axis
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_title("Memory Visualization of Variables")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, len(variables) + 1)
    ax.axis('off')  # Hide axes
    
    # Draw memory boxes for each variable
    for i, var in enumerate(variables):
        name = var["name"]
        var_type = var["type"]
        value = var.get("value", "N/A")
        
        # Draw a box for the variable
        box = Rectangle((1, len(variables) - i), 6, 0.8, edgecolor='black', facecolor='lightblue')
        ax.add_patch(box)
        
        # Add variable details inside the box
        ax.text(1.1, len(variables) - i + 0.5, f"{name}: {var_type} = {value}", 
                fontsize=12, va='center')
    
    plt.savefig('output.png')

if __name__ == "__main__":
    load_and_visualize()