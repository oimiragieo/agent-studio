"""
Agent Template
Based on Claude Cookbooks Chief of Staff agent pattern

Replace [Your Agent Name] and customize for your use case.
"""

import asyncio
import json
import os
from collections.abc import Callable
from typing import Any, Literal

from dotenv import load_dotenv

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

load_dotenv()


def get_activity_text(msg: Any) -> str | None:
    """Extract activity text from a message"""
    try:
        if "Assistant" in msg.__class__.__name__:
            if hasattr(msg, "content") and msg.content:
                first_content = msg.content[0] if isinstance(msg.content, list) else msg.content
                if hasattr(first_content, "name"):
                    return f"🤖 Using: {first_content.name}()"
            return "🤖 Thinking..."
        elif "User" in msg.__class__.__name__:
            return "✓ Tool completed"
    except (AttributeError, IndexError):
        pass
    return None


def print_activity(msg: Any) -> None:
    """Print activity to console"""
    activity = get_activity_text(msg)
    if activity:
        print(activity)


async def send_query(
    prompt: str,
    continue_conversation: bool = False,
    permission_mode: Literal["default", "plan", "acceptEdits"] = "default",
    output_style: str | None = None,
    activity_handler: Callable[[Any], None | Any] = print_activity,
) -> tuple[str | None, list]:
    """
    Send a query to the agent with all features integrated.

    Args:
        prompt: The query to send (can include slash commands)
        activity_handler: Callback for activity updates (default: print_activity)
        continue_conversation: Continue the previous conversation if True
        permission_mode: "default" (execute), "plan" (think only), or "acceptEdits"
        output_style: Override output style (e.g., "executive", "technical")

    Returns:
        Tuple of (result, messages) - result is the final text, messages is the full conversation

    Features automatically included/leveraged:
        - Memory: CLAUDE.md context loaded from agent directory
        - Subagents: Via Task tool (defined in .claude/agents)
        - Custom scripts: Python scripts in scripts/ via Bash
        - Slash commands: Expanded from .claude/commands/
        - Output styles: Custom output styles defined in .claude/output-styles
        - Hooks: Triggered based on settings.local.json, defined in .claude/hooks
    """

    # Customize this system prompt for your agent
    system_prompt = """You are [Your Agent Name], [brief description of purpose].

    Apart from your tools and subagents, you also have custom Python scripts in the scripts/ directory you can run with Bash:
    - python scripts/script1.py: [Description]
    - python scripts/script2.py: [Description]

    You have access to data in the data/ directory.
    """

    # Build options with optional output style
    settings = None
    if output_style:
        settings = json.dumps({"outputStyle": output_style})

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",  # Change to opus or haiku as needed
        allowed_tools=[
            "Task",  # Enables subagent delegation
            "Read",
            "Write",
            "Edit",
            "Bash",
            "WebSearch",
            # Add other tools as needed
        ],
        continue_conversation=continue_conversation,
        system_prompt=system_prompt,
        permission_mode=permission_mode,
        cwd=os.path.dirname(os.path.abspath(__file__)),
        settings=settings,
        # IMPORTANT: setting_sources must include "project" to load filesystem settings:
        # - Slash commands from .claude/commands/
        # - CLAUDE.md project instructions
        # - Subagent definitions from .claude/agents/
        # - Hooks from .claude/settings.local.json
        # Without this, the SDK operates in isolation mode with no filesystem settings loaded.
        setting_sources=["project", "local"],
    )

    result = None
    messages = []  # This is to append the messages ONLY for this agent turn

    try:
        async with ClaudeSDKClient(options=options) as agent:
            await agent.query(prompt=prompt)
            async for msg in agent.receive_response():
                messages.append(msg)
                if asyncio.iscoroutinefunction(activity_handler):
                    await activity_handler(msg)
                else:
                    activity_handler(msg)

                if hasattr(msg, "result"):
                    result = msg.result
    except Exception as e:
        print(f"❌ Query error: {e}")
        raise

    return result, messages


# Example usage
if __name__ == "__main__":
    async def main():
        result, messages = await send_query("Hello, what can you do?")
        print(result)

    asyncio.run(main())
