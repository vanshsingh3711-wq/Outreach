FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    OUTREACH_HOME=/app

# System deps (curl needed for the Claude CLI installer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first (cached layer — rebuilds only when requirements change),
# then Chromium + its system libraries in the same layer cleanup pass.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# Match the checkout owner on Linux; remain non-root.
ARG OUTREACH_UID=1000
ARG OUTREACH_GID=1000
RUN test "$OUTREACH_UID" -gt 0 && test "$OUTREACH_GID" -gt 0 \
    && groupadd --gid "$OUTREACH_GID" outreach \
    && useradd --create-home --uid "$OUTREACH_UID" --gid "$OUTREACH_GID" outreach \
    && mkdir -p /app/data \
    && chown -R outreach:outreach /app /ms-playwright

# Copy project (config/prompts are typically bind-mounted over these at runtime)
COPY --chown=outreach:outreach outreach/ outreach/
COPY --chown=outreach:outreach prompts/ prompts/
COPY --chown=outreach:outreach skills/ skills/
COPY --chown=outreach:outreach outreach.yaml .

USER outreach
ENV PATH="/home/outreach/.local/bin:${PATH}"

# Claude Code CLI, installed as the runtime user so ~/.local/bin is correct.
# Download separately so fetch failures cannot be hidden by a shell pipeline.
# Fail the build if installation or Outreach's CLI isolation check fails.
RUN installer="$(mktemp)" \
    && curl -fsSL https://claude.ai/install.sh -o "$installer" \
    && bash "$installer" \
    && rm "$installer" \
    && python -c "from outreach.claude_runtime import check_cli; print(check_cli())"

# Healthy = the dashboard is accepting connections on its loopback port. The
# heartbeat loop is started from the dashboard on demand, so database activity
# is not a reliable liveness signal for the container's main process.
HEALTHCHECK --interval=1m --timeout=10s --start-period=1m --retries=3 \
  CMD python -c "import socket; socket.create_connection(('127.0.0.1', 5555), timeout=5).close()"

# WebUI first: `docker run` serves the dashboard; it starts/stops the
# heartbeat loop itself. Any arguments replace the default command, so
# `docker compose run --rm outreach setup` runs the setup wizard.
ENTRYPOINT ["python", "-m", "outreach"]
CMD ["dashboard"]
