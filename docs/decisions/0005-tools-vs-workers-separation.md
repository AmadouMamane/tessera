# 5. Separation of tools and workers in the agent layer

Date: 2026-05-27

## Status

Accepted

## Context

The Tessera agent is built on LangGraph. Its execution is described as a state graph in which nodes consume and produce a shared state, and edges are conditional transitions between nodes. The agent also exposes a set of callable functions to the underlying language model via the model's native function-calling or tool-use interface — these are the means by which the LLM requests concrete actions like fetching an account balance, searching the transaction history, or blocking a card.

Both concepts are colloquially called "tools" in the agent literature, and both are sometimes called "agents" or "workers" in the multi-agent literature. The terminology collapses two distinct objects into one bucket, and this collapse leads to a recurring class of design mistake: writing a function that is simultaneously a LangGraph node *and* an LLM-callable tool. The function ends up entangling orchestration concerns (state transition, retry, error handling, escalation routing) with action concerns (input validation against an LLM-provided schema, side effect on an external system, structured output back to the model). The result is hard to test in isolation, hard to reuse across graph topologies, and hard to swap out when the orchestrator changes.

The two objects deserve different names, different locations in the codebase, and different testing strategies. A *worker* in Tessera is a LangGraph node — a Python callable whose input and output are the agent state, whose responsibility is orchestration, and whose only LLM interaction is to send prompts and receive completions or tool-call requests. A *tool* in Tessera is an LLM-callable function — a Python callable whose input is a typed argument structure declared via Pydantic, whose responsibility is to perform one concrete action on the world (read or write), and whose output is a typed response that the LLM consumes via the tool-use protocol.

A worker may call zero or more tools during its node execution; a worker may exist that calls no tools at all (for example, a pure-classification router worker). A tool exists independently of any particular worker and can be invoked by multiple workers. Tools never know about agent state directly; they receive only their declared arguments. Workers never know about tool-call wire formats; they delegate to the tool registry.

## Decision

The agent code is split along this distinction. LangGraph nodes live under `src/tessera/agent/workers/` and are named by their role in the graph (`router.py` at the agent root, `planner.py` likewise, and `workers/{product_lookup,regulation_lookup,account_lookup,simulator,escalation}.py` for the per-domain workers). LLM-callable tools live under `src/tessera/agent/tools/` and are named by the action they perform (`account_balance.py`, `card_block.py`, `transaction_search.py`, `loan_simulate.py`, `ticket_escalate.py`).

Workers import tools from the tool registry; tools never import workers. Tools never read or write the LangGraph state object; they receive only their declared Pydantic arguments and return only typed responses. The tool registry is assembled at agent startup and exposed to the LLM via LangGraph's tool-binding mechanism.

Unit tests target tools and workers separately. Tool tests exercise the action in isolation against a fake of the external system. Worker tests exercise the node logic against a fake LLM that returns deterministic tool-call sequences. Integration tests exercise the assembled graph end to end.

## Consequences

Tools are reusable across worker topologies; if the orchestrator changes (LangGraph to a hypothetical successor, or a vendor-specific orchestrator on a partner deployment), tools port unchanged. Workers are testable without spinning up the real LLM. The separation makes the agent legible to a reader who has never seen Tessera before: they can read `tools/` to understand what the agent *can do*, and `workers/` to understand *how it decides what to do next*.

The cost is one additional directory and one mental distinction to maintain. Pull requests that conflate the two are rejected with a pointer to this ADR. New contributors who do not yet have the distinction internalized are guided by the file layout itself — placing a function under `workers/` when it should be a tool, or vice versa, surfaces in review the moment the file path is read.
