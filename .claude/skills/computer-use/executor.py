"""
Executor for Computer Use Skill - Handles Playwright browser automation via MCP.

This executor connects to a FastMCP server for browser automation
and executes tool calls on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'

Requirements:
    - Python 3.10+
    - fastmcp>=2.12
    - playwright>=1.55
    - pillow>=11.0

Environment Variables:
    - CU_HEADFUL: Show browser window (1/true/yes)
    - CU_SLOW_MO: Delay between actions in ms (default: 250)
    - CU_SHOW_CURSOR: Show cursor overlay (1/true/yes)
    - CU_NO_SANDBOX: Disable Chromium sandbox (1/true/yes)
"""

import json
import sys
import subprocess
import os
import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr
)
log = logging.getLogger("computer-use-executor")

# Default configuration
DEFAULT_HEADLESS = True
DEFAULT_SLOW_MO_MS = int(os.getenv("CU_SLOW_MO", "250"))
SHOW_CURSOR = os.getenv("CU_SHOW_CURSOR", "").strip().lower() in ("1", "true", "yes")

# Cursor overlay JavaScript for visual feedback
CURSOR_OVERLAY_JS = """
(function() {
    if (window.__cursorOverlay) return;
    const cursor = document.createElement('div');
    cursor.id = '__cursor_overlay';
    cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 0, 0, 0.5);
        border: 2px solid red;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: all 0.1s ease;
        display: none;
    `;
    document.body.appendChild(cursor);
    window.__cursorOverlay = cursor;
    window.__updateCursor = function(x, y, clicking) {
        cursor.style.display = 'block';
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.background = clicking ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.5)';
        cursor.style.transform = clicking ? 'translate(-50%, -50%) scale(0.8)' : 'translate(-50%, -50%)';
    };
})();
"""


def check_dependencies():
    """Check if required dependencies are installed."""
    missing = []

    try:
        import fastmcp
    except ImportError:
        missing.append("fastmcp>=2.12")

    try:
        import playwright
    except ImportError:
        missing.append("playwright>=1.55")

    try:
        from PIL import Image
    except ImportError:
        missing.append("pillow>=11.0")

    if missing:
        print(f"Missing dependencies: {', '.join(missing)}", file=sys.stderr)
        print("Installing dependencies...", file=sys.stderr)
        subprocess.run([sys.executable, "-m", "pip", "install"] + missing, check=True)
        print("Dependencies installed. Please run the command again.", file=sys.stderr)
        sys.exit(0)

    return True


def check_playwright_browsers():
    """Check if Playwright browsers are installed."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "--dry-run", "chromium"],
            capture_output=True,
            text=True
        )
        if "chromium" in result.stdout.lower() or result.returncode != 0:
            print("Installing Playwright Chromium browser...", file=sys.stderr)
            subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                check=True
            )
    except Exception as e:
        log.warning(f"Could not verify Playwright browsers: {e}")


class ComputerUseExecutor:
    """Executor for Computer Use MCP server tools."""

    def __init__(self):
        """Initialize executor."""
        check_dependencies()
        check_playwright_browsers()

        # Import after dependency check
        from playwright.async_api import async_playwright, Page

        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None
        self._screen_width = 1440
        self._screen_height = 900

        # Tool definitions
        self._tools = [
            {
                "name": "initialize_browser",
                "description": "Launch Playwright browser with URL, viewport size, and headless mode",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "Initial URL to navigate to"},
                        "width": {"type": "integer", "description": "Viewport width (default: 1440)"},
                        "height": {"type": "integer", "description": "Viewport height (default: 900)"},
                        "headless": {"type": "boolean", "description": "Run headless (overrides CU_HEADFUL env)"}
                    },
                    "required": ["url"]
                }
            },
            {
                "name": "execute_action",
                "description": "Execute browser action: open_web_browser, click_at, type_text_at, scroll_to_percent, press_key, execute_javascript",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "action_name": {
                            "type": "string",
                            "enum": ["open_web_browser", "click_at", "type_text_at", "scroll_to_percent", "press_key", "execute_javascript"],
                            "description": "Action to execute"
                        },
                        "args": {"type": "object", "description": "Action-specific arguments"}
                    },
                    "required": ["action_name", "args"]
                }
            },
            {
                "name": "capture_state",
                "description": "Take screenshot and return path + current URL",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "action_name": {"type": "string", "description": "Label for screenshot file"},
                        "result_ok": {"type": "boolean", "description": "Whether previous action succeeded"},
                        "error_msg": {"type": "string", "description": "Error message if action failed"}
                    },
                    "required": ["action_name"]
                }
            },
            {
                "name": "click_selector",
                "description": "Click element by CSS selector",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string", "description": "CSS selector"},
                        "nth": {"type": "integer", "description": "Index if multiple matches (default: 0)"}
                    },
                    "required": ["selector"]
                }
            },
            {
                "name": "fill_selector",
                "description": "Fill form field by CSS selector",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "selector": {"type": "string", "description": "CSS selector for input"},
                        "text": {"type": "string", "description": "Text to enter"},
                        "press_enter": {"type": "boolean", "description": "Press Enter after typing"},
                        "clear": {"type": "boolean", "description": "Clear field before typing (default: true)"}
                    },
                    "required": ["selector", "text"]
                }
            },
            {
                "name": "close_browser",
                "description": "Close browser and release all resources",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools."""
        return self._tools

    async def _await_render(self, page) -> None:
        """Wait for page to finish rendering."""
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            log.warning("Page load wait timed out.")
        await page.wait_for_timeout(300)

    def _denormalize_x(self, x: int) -> int:
        """Convert 0-1000 x coordinate to pixels."""
        return int(int(x) / 1000 * self._screen_width)

    def _denormalize_y(self, y: int) -> int:
        """Convert 0-1000 y coordinate to pixels."""
        return int(int(y) / 1000 * self._screen_height)

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool with the given arguments."""
        from playwright.async_api import async_playwright

        try:
            if tool_name == "initialize_browser":
                return await self._initialize_browser(arguments)
            elif tool_name == "execute_action":
                return await self._execute_action(arguments)
            elif tool_name == "capture_state":
                return await self._capture_state(arguments)
            elif tool_name == "click_selector":
                return await self._click_selector(arguments)
            elif tool_name == "fill_selector":
                return await self._fill_selector(arguments)
            elif tool_name == "close_browser":
                return await self._close_browser()
            else:
                return {"ok": False, "error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            log.error(f"Error calling tool {tool_name}: {e}")
            return {"ok": False, "error": str(e)}

    async def _initialize_browser(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize Playwright browser."""
        from playwright.async_api import async_playwright

        url = args.get("url", "about:blank")
        width = args.get("width", 1440)
        height = args.get("height", 900)
        headless = args.get("headless")

        self._screen_width = int(width)
        self._screen_height = int(height)

        # Close existing browser if any
        if self._page:
            await self._close_browser()

        try:
            self._playwright = await async_playwright().start()

            # Determine headless mode
            if headless is None:
                headful_env = os.getenv("CU_HEADFUL", "")
                effective_headless = not (headful_env.strip().lower() in ("1", "true", "yes"))
            else:
                effective_headless = bool(headless)

            # Launch options
            launch_args = {}
            if os.getenv("CU_NO_SANDBOX", "").strip().lower() in ("1", "true", "yes"):
                launch_args["args"] = ["--no-sandbox"]

            self._browser = await self._playwright.chromium.launch(
                headless=effective_headless,
                slow_mo=DEFAULT_SLOW_MO_MS,
                **launch_args
            )

            self._context = await self._browser.new_context(
                viewport={"width": self._screen_width, "height": self._screen_height},
                device_scale_factor=2
            )

            self._page = await self._context.new_page()

            # Add cursor overlay if enabled
            if SHOW_CURSOR:
                await self._page.add_init_script(CURSOR_OVERLAY_JS)
                try:
                    await self._page.evaluate(CURSOR_OVERLAY_JS)
                except Exception:
                    pass

            await self._page.goto(url, timeout=20000)
            await self._await_render(self._page)

            log.info(f"Browser initialized to {url} at {width}x{height}")

            return {
                "ok": True,
                "url": self._page.url,
                "width": self._screen_width,
                "height": self._screen_height,
                "headless": effective_headless,
                "slow_mo_ms": DEFAULT_SLOW_MO_MS
            }
        except Exception as e:
            log.error(f"Initialization failed: {e}")
            await self._close_browser()
            return {"ok": False, "error": f"Browser initialization failed: {e}"}

    async def _execute_action(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a browser action."""
        if self._page is None:
            return {"ok": False, "error": "Browser not initialized. Use initialize_browser first."}

        action_name = args.get("action_name")
        action_args = args.get("args", {})

        log.info(f"Executing action: {action_name} with args: {action_args}")

        try:
            result = {"status": "Action completed successfully."}

            if action_name == "open_web_browser":
                url = action_args.get("url", "about:blank")
                await self._page.goto(url, timeout=20000)
                result["status"] = f"Navigated to {self._page.url}"

            elif action_name == "click_at":
                if "x" not in action_args or "y" not in action_args:
                    raise ValueError("click_at requires 'x' and 'y' in 0-1000 range")
                x = self._denormalize_x(action_args["x"])
                y = self._denormalize_y(action_args["y"])

                if SHOW_CURSOR:
                    try:
                        await self._page.evaluate(f"window.__updateCursor && __updateCursor({x},{y},false)")
                    except Exception:
                        pass

                await self._page.mouse.move(x, y)
                await self._page.mouse.click(x, y)

                if SHOW_CURSOR:
                    try:
                        await self._page.evaluate(f"window.__updateCursor && __updateCursor({x},{y},true)")
                    except Exception:
                        pass

                result["status"] = f"Clicked at ({x}, {y})"

            elif action_name == "type_text_at":
                for k in ("x", "y", "text"):
                    if k not in action_args:
                        raise ValueError(f"type_text_at requires '{k}'")

                x = self._denormalize_x(action_args["x"])
                y = self._denormalize_y(action_args["y"])
                text = str(action_args["text"])
                press_enter = bool(action_args.get("press_enter", False))

                await self._page.mouse.move(x, y)
                await self._page.mouse.click(x, y)

                # Try to focus and clear any existing text
                focused_ok = await self._page.evaluate(
                    """([x, y]) => {
                        const el = document.elementFromPoint(x, y);
                        if (!el) return false;
                        const target = el.closest('input,textarea,[contenteditable="true"],[role="searchbox"],[type="search"]');
                        if (!target) return false;
                        target.focus();
                        try {
                            if (target.select) target.select();
                            else if (target.setSelectionRange && typeof target.value === 'string') {
                                target.setSelectionRange(0, target.value.length);
                            }
                        } catch (_) {}
                        return true;
                    }""",
                    [x, y]
                )

                if focused_ok:
                    try:
                        await self._page.evaluate(
                            "if (document.activeElement && 'value' in document.activeElement) document.activeElement.value='';"
                        )
                    except Exception:
                        pass

                await self._page.keyboard.type(text)

                if press_enter:
                    await self._page.keyboard.press("Enter")

                result["status"] = f"Typed text at ({x}, {y}), enter: {press_enter}"

            elif action_name == "scroll_to_percent":
                if "y" not in action_args:
                    raise ValueError("scroll_to_percent requires 'y' in 0-1000 range")

                y_norm = max(0, min(1000, int(action_args["y"])))

                await self._page.evaluate(f"""
                    (async () => {{
                        const H = Math.max(
                            document.body?.scrollHeight || 0,
                            document.documentElement?.scrollHeight || 0
                        );
                        const target = (H * {y_norm}) / 1000;
                        window.scrollTo({{ top: target, behavior: 'smooth' }});
                    }})();
                """)
                await self._page.wait_for_timeout(600)
                result["status"] = f"Scrolled to {y_norm}/1000"

            elif action_name == "press_key":
                key = str(action_args.get("key", "")).strip()
                if not key:
                    raise ValueError("press_key requires 'key', e.g., 'Enter' or 'Meta+L'")
                await self._page.keyboard.press(key)
                result["status"] = f"Pressed {key}"

            elif action_name == "execute_javascript":
                code = str(action_args.get("code", "")).strip()
                if not code:
                    raise ValueError("execute_javascript requires 'code' string")
                js_result = await self._page.evaluate(code)
                result["status"] = "JS executed"
                result["result"] = js_result

            else:
                result = {"status": f"Unknown action: {action_name}", "error": True}

            await self._await_render(self._page)
            return {"ok": True, "action_name": action_name, "result": result}

        except Exception as e:
            log.error(f"Error executing {action_name}: {e}")
            return {"ok": False, "action_name": action_name, "error": str(e)}

    async def _capture_state(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Capture screenshot of current browser state."""
        if self._page is None:
            return {"ok": False, "error": "Browser not initialized."}

        try:
            action_name = args.get("action_name", "state")
            result_ok = args.get("result_ok", True)
            error_msg = args.get("error_msg", "")

            screenshot_bytes = await self._page.screenshot(type="png")

            # Save to temp directory
            temp_dir = Path("/tmp/computer_use_screenshots")
            if sys.platform == "win32":
                temp_dir = Path(os.environ.get("TEMP", "/tmp")) / "computer_use_screenshots"
            temp_dir.mkdir(parents=True, exist_ok=True)

            fname = f"{int(time.time() * 1000)}_{action_name}.png"
            fpath = temp_dir / fname

            with open(fpath, "wb") as f:
                f.write(screenshot_bytes)

            response_data = {"url": self._page.url}
            if not result_ok:
                response_data["error"] = error_msg

            return {
                "ok": True,
                "path": str(fpath),
                "mime_type": "image/png",
                "url": self._page.url,
                "response_data": response_data
            }
        except Exception as e:
            log.error(f"Error capturing state: {e}")
            return {"ok": False, "error": f"State capture failed: {e}"}

    async def _click_selector(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Click element by CSS selector."""
        if self._page is None:
            return {"ok": False, "error": "Browser not initialized."}

        selector = args.get("selector")
        nth = args.get("nth", 0)

        try:
            loc = self._page.locator(selector).nth(nth)
            await loc.wait_for(state="visible", timeout=8000)
            await loc.click()
            await self._await_render(self._page)
            return {"ok": True, "status": f"Clicked selector {selector} [nth={nth}]"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def _fill_selector(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Fill form field by CSS selector."""
        if self._page is None:
            return {"ok": False, "error": "Browser not initialized."}

        selector = args.get("selector")
        text = args.get("text", "")
        press_enter = args.get("press_enter", False)
        clear = args.get("clear", True)

        try:
            loc = self._page.locator(selector).first
            await loc.wait_for(state="visible", timeout=8000)
            await loc.click()

            if clear:
                try:
                    await loc.fill("")
                except Exception:
                    await self._page.evaluate(
                        "(sel)=>{const el=document.querySelector(sel); if(el && 'value' in el) el.value='';}",
                        selector
                    )

            await loc.type(text)

            if press_enter:
                await self._page.keyboard.press("Enter")

            await self._await_render(self._page)
            return {"ok": True, "status": f"Filled {selector} with text", "pressed_enter": press_enter}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def _close_browser(self) -> Dict[str, Any]:
        """Close browser and release resources."""
        try:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()

            log.info("Browser closed successfully.")
            return {"ok": True}
        except Exception as e:
            log.error(f"Error closing browser: {e}")
            return {"ok": False, "error": str(e)}
        finally:
            self._playwright = None
            self._browser = None
            self._context = None
            self._page = None
            self._screen_width = 1440
            self._screen_height = 900


def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute Computer Use MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")

    args = parser.parse_args()

    executor = ComputerUseExecutor()

    if args.list:
        tools = executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = asyncio.run(executor.call_tool(args.tool, arguments))
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
