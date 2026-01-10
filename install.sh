#!/bin/bash
# Skills Store Installer for macOS/Linux
# Installs skills, agents, and commands to ~/.claude

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/.claude"
TARGET_DIR="$HOME/.claude"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Skills Store Installer (Unix)        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if source .claude directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: .claude directory not found in $SCRIPT_DIR${NC}"
    exit 1
fi

# Create target directories if they don't exist
echo -e "${YELLOW}Creating target directories...${NC}"
mkdir -p "$TARGET_DIR/skills"
mkdir -p "$TARGET_DIR/agents"
mkdir -p "$TARGET_DIR/commands"

# Function to copy contents of a directory
copy_contents() {
    local src_folder="$1"
    local dst_folder="$2"
    local folder_name="$3"
    
    if [ -d "$src_folder" ]; then
        echo -e "${BLUE}Installing $folder_name...${NC}"
        
        # Get list of items in source folder
        for item in "$src_folder"/*; do
            if [ -e "$item" ]; then
                item_name=$(basename "$item")
                target_path="$dst_folder/$item_name"
                
                if [ -e "$target_path" ]; then
                    echo -e "  ${YELLOW}[UPDATE]${NC} $item_name"
                else
                    echo -e "  ${GREEN}[NEW]${NC} $item_name"
                fi
                
                # Copy recursively, overwriting existing files
                cp -r "$item" "$dst_folder/"
            fi
        done
        
        echo -e "${GREEN}✓ $folder_name installed${NC}"
    else
        echo -e "${YELLOW}⚠ No $folder_name found in source${NC}"
    fi
}

# Install each component
echo ""
copy_contents "$SOURCE_DIR/skills" "$TARGET_DIR/skills" "Skills"
echo ""
copy_contents "$SOURCE_DIR/agents" "$TARGET_DIR/agents" "Agents"
echo ""
copy_contents "$SOURCE_DIR/commands" "$TARGET_DIR/commands" "Commands"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete!               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "Installed to: ${BLUE}$TARGET_DIR${NC}"
echo ""
echo "Installed components:"
echo -e "  • Skills:   $(ls -1 "$TARGET_DIR/skills" 2>/dev/null | wc -l | tr -d ' ') items"
echo -e "  • Agents:   $(ls -1 "$TARGET_DIR/agents" 2>/dev/null | wc -l | tr -d ' ') items"
echo -e "  • Commands: $(ls -1 "$TARGET_DIR/commands" 2>/dev/null | wc -l | tr -d ' ') items"
echo ""
