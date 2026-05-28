"""Language-specific prompt bundles for the agent.

Each bundle is a YAML file at the package root (``fr.yaml``, ``de.yaml``,
``en.yaml``). They are loaded by :func:`tessera.agent.reporter.load_prompts`
via importlib.resources so the bundles ship inside the wheel.
"""
