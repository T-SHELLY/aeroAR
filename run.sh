#!/bin/bash

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: 'uv' command not found"
    echo "Please install uv first:"
    echo "  pip install uv"
    exit 1
fi

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "📦 Virtual environment not found"
    echo "Creating virtual environment with 'uv venv'..."
    uv venv

    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi

    echo "✅ Virtual environment created successfully"
    echo "📥 Installing dependencies from pyproject.toml..."
    uv sync

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi

    echo "✅ Dependencies installed successfully"
fi

# Activate virtual environment and run the app
echo "🚀 Starting AeroAR application..."
source .venv/bin/activate
uv sync
uv run main.py
