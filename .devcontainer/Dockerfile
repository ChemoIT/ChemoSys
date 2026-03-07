# =============================================================================
# ChemoSystem Dev Container
# Purpose: Sandboxed environment for autonomous Claude Code execution.
#          Protects host from supply chain attacks via npm packages.
# =============================================================================

FROM node:22-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    procps \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI — pinned to 2.1.66 (newer versions break Hebrew RTL in chat)
RUN npm install -g @anthropic-ai/claude-code@2.1.66

# Non-root user for reduced privileges inside container
RUN useradd -m -s /bin/bash dev \
    && mkdir -p /home/dev/.claude \
    && chown -R dev:dev /home/dev \
    && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/dev

USER dev
WORKDIR /workspace
