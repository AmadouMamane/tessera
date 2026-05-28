"""LangGraph agent orchestration layer.

The agent is composed of three categories of code:

* **Top-level nodes** (``router``, ``planner``, ``reviewer``, ``reporter``)
  that shape the conversation flow and live in this package directly.
* **Workers** (``workers/``) — LangGraph nodes that fan out to read from
  retrieval, account systems, and the simulator. They are *not* LLM-callable.
* **Tools** (``tools/``) — typed function targets exposed to the LLM via
  function calling. They are *not* LangGraph nodes.

The separation between workers and tools is binding; see ADR 0005.

Use :func:`tessera.agent.graph.build_graph` to obtain a compiled LangGraph
ready to invoke.
"""

from __future__ import annotations

from tessera.agent.graph import build_graph, compile_graph
from tessera.agent.state import AgentState, NodeName

__all__ = ["AgentState", "NodeName", "build_graph", "compile_graph"]
