"""Restrictions applied to every agent: no general-purpose subagent, none of deepagents' file tools.

deepagents ships `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep` and `delete` (working on an in-memory
state, not the host disk, since no sandbox backend is configured) plus a general-purpose subagent. This app's agents
only read orders through the tools in tools.py, so all of that is switched off. `DENY_FILES` additionally denies
any file operation if a tool were ever re-enabled by a library upgrade.
"""
from deepagents import FilesystemPermission, HarnessProfile, register_harness_profile
from deepagents.profiles import GeneralPurposeSubagentProfile

FILE_TOOLS = frozenset({"ls", "read_file", "write_file", "edit_file", "glob", "grep", "delete", "execute"})

PROFILE = HarnessProfile(excluded_tools=FILE_TOOLS, general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False))
DENY_FILES = [FilesystemPermission(operations=["read", "write"], paths=["/**"], mode="deny")]


def restrict(provider: str = "openai") -> None:
    """Registers the restrictions for the models of one provider (tests register their fake model's name too)."""
    register_harness_profile(provider, PROFILE)


restrict("openai")
