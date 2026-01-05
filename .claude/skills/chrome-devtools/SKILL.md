---
name: chrome-devtools
description: Chrome DevTools for AI agents. Control and inspect live Chrome browsers with performance tracing, network inspection, DOM snapshots, and automated interactions. Use for web debugging, performance analysis, and browser automation.
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Start with navigate_page before other operations
  - Use take_screenshot to verify page state
  - Check console messages for errors
  - Use performance tracing for optimization tasks
  - Handle dialogs before they block automation
error_handling: graceful
streaming: supported
---

# Chrome DevTools Skill

## Overview

This skill gives AI agents access to Chrome DevTools for controlling and inspecting live Chrome browsers. It provides 26 tools for browser automation, performance analysis, network inspection, and debugging.

**Context Savings**: ~93% reduction
- **MCP Mode**: ~25,000 tokens always loaded
- **Skill Mode**: ~600 tokens metadata + on-demand loading

## When to Use

- Debugging web applications in real browsers
- Performance profiling and optimization
- Network request inspection and analysis
- Automated browser testing
- Taking screenshots and DOM snapshots
- Form filling and interaction automation
- Device/network emulation testing

## Quick Reference

```bash
# List available tools
python executor.py --list

# Navigate to a page
python executor.py --tool navigate_page --args '{"url": "https://example.com"}'

# Take a screenshot
python executor.py --tool take_screenshot --args '{}'

# Start performance trace
python executor.py --tool performance_start_trace --args '{}'
```

## Tools

### Input Automation (8 tools)

#### click

Interact with page elements by clicking.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | CSS selector or element reference |
| `options` | object | Click options (button, clickCount, etc.) |

```bash
python executor.py --tool click --args '{"selector": "#submit-button"}'
```

#### drag

Perform drag operations on elements.

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Source element selector |
| `target` | string | Target element selector or coordinates |

```bash
python executor.py --tool drag --args '{"source": "#draggable", "target": "#dropzone"}'
```

#### fill

Input text into form fields.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | Input field selector |
| `value` | string | Text to enter |

```bash
python executor.py --tool fill --args '{"selector": "#email", "value": "user@example.com"}'
```

#### fill_form

Complete multiple form fields at once.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | object | Map of selectors to values |

```bash
python executor.py --tool fill_form --args '{"fields": {"#name": "John", "#email": "john@example.com"}}'
```

#### handle_dialog

Respond to browser dialogs (alerts, confirms, prompts).

| Parameter | Type | Description |
|-----------|------|-------------|
| `accept` | boolean | Whether to accept or dismiss |
| `promptText` | string | Text for prompt dialogs |

```bash
python executor.py --tool handle_dialog --args '{"accept": true}'
```

#### hover

Move cursor over elements to trigger hover states.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | Element selector to hover |

```bash
python executor.py --tool hover --args '{"selector": ".dropdown-trigger"}'
```

#### press_key

Simulate keyboard input.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key to press (e.g., "Enter", "Tab", "Escape") |
| `modifiers` | array | Modifier keys (e.g., ["Control", "Shift"]) |

```bash
python executor.py --tool press_key --args '{"key": "Enter"}'
```

#### upload_file

Submit files through file input controls.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | File input selector |
| `filePaths` | array | Paths to files to upload |

```bash
python executor.py --tool upload_file --args '{"selector": "#file-input", "filePaths": ["/path/to/file.pdf"]}'
```

### Navigation Automation (6 tools)

#### navigate_page

Direct the browser to specific URLs.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to navigate to |
| `waitUntil` | string | Wait condition (load, domcontentloaded, networkidle) |

```bash
python executor.py --tool navigate_page --args '{"url": "https://example.com", "waitUntil": "networkidle"}'
```

#### new_page

Create additional browser tabs.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | Optional URL for new page |

```bash
python executor.py --tool new_page --args '{"url": "https://example.com"}'
```

#### close_page

Shut down individual browser tabs/windows.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | string | ID of page to close (optional, closes current) |

```bash
python executor.py --tool close_page --args '{}'
```

#### list_pages

Retrieve all open browser pages.

```bash
python executor.py --tool list_pages --args '{}'
```

#### select_page

Switch between active pages.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | string | ID of page to select |

```bash
python executor.py --tool select_page --args '{"pageId": "page-123"}'
```

#### wait_for

Pause execution until conditions are met.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | Element to wait for |
| `state` | string | State to wait for (visible, hidden, attached, detached) |
| `timeout` | number | Maximum wait time in ms |

```bash
python executor.py --tool wait_for --args '{"selector": "#loading", "state": "hidden"}'
```

### Emulation (2 tools)

#### emulate

Simulate different device types and configurations.

| Parameter | Type | Description |
|-----------|------|-------------|
| `device` | string | Device name (e.g., "iPhone 12", "Pixel 5") |
| `userAgent` | string | Custom user agent |
| `viewport` | object | Custom viewport dimensions |

```bash
python executor.py --tool emulate --args '{"device": "iPhone 12"}'
```

#### resize_page

Adjust viewport dimensions.

| Parameter | Type | Description |
|-----------|------|-------------|
| `width` | number | Viewport width in pixels |
| `height` | number | Viewport height in pixels |

```bash
python executor.py --tool resize_page --args '{"width": 1920, "height": 1080}'
```

### Performance Analysis (3 tools)

#### performance_start_trace

Begin recording performance data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `categories` | array | Trace categories to capture |

```bash
python executor.py --tool performance_start_trace --args '{}'
```

#### performance_stop_trace

Complete performance recording session.

```bash
python executor.py --tool performance_stop_trace --args '{}'
```

#### performance_analyze_insight

Extract actionable performance metrics.

| Parameter | Type | Description |
|-----------|------|-------------|
| `traceData` | object | Trace data from stopped trace |

```bash
python executor.py --tool performance_analyze_insight --args '{}'
```

### Network Inspection (2 tools)

#### list_network_requests

View all intercepted network activity.

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | object | Filter by URL pattern, status, type |

```bash
python executor.py --tool list_network_requests --args '{}'
```

#### get_network_request

Retrieve specific network request details.

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestId` | string | ID of the request |

```bash
python executor.py --tool get_network_request --args '{"requestId": "req-123"}'
```

### Debugging & Inspection (5 tools)

#### take_screenshot

Capture visual page state.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fullPage` | boolean | Capture full scrollable page |
| `selector` | string | Specific element to capture |
| `format` | string | Image format (png, jpeg, webp) |

```bash
python executor.py --tool take_screenshot --args '{"fullPage": true}'
```

#### take_snapshot

Record DOM structure snapshots.

```bash
python executor.py --tool take_snapshot --args '{}'
```

#### evaluate_script

Execute JavaScript within page context.

| Parameter | Type | Description |
|-----------|------|-------------|
| `expression` | string | JavaScript code to execute |

```bash
python executor.py --tool evaluate_script --args '{"expression": "document.title"}'
```

#### list_console_messages

Access all logged console messages.

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | string | Filter by level (log, warn, error, info) |

```bash
python executor.py --tool list_console_messages --args '{"level": "error"}'
```

#### get_console_message

Retrieve specific console output.

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | string | ID of the console message |

```bash
python executor.py --tool get_console_message --args '{"messageId": "msg-123"}'
```

## Common Workflows

### Debug a Web Page

```bash
# 1. Navigate to page
python executor.py --tool navigate_page --args '{"url": "https://myapp.com"}'

# 2. Check for console errors
python executor.py --tool list_console_messages --args '{"level": "error"}'

# 3. Take screenshot of current state
python executor.py --tool take_screenshot --args '{}'

# 4. Inspect network requests
python executor.py --tool list_network_requests --args '{}'
```

### Performance Analysis

```bash
# 1. Start trace
python executor.py --tool performance_start_trace --args '{}'

# 2. Navigate/interact with page
python executor.py --tool navigate_page --args '{"url": "https://myapp.com"}'

# 3. Stop trace and analyze
python executor.py --tool performance_stop_trace --args '{}'
python executor.py --tool performance_analyze_insight --args '{}'
```

### Form Automation

```bash
# 1. Navigate to form
python executor.py --tool navigate_page --args '{"url": "https://myapp.com/login"}'

# 2. Fill form fields
python executor.py --tool fill_form --args '{"fields": {"#username": "user", "#password": "pass"}}'

# 3. Submit
python executor.py --tool click --args '{"selector": "#submit"}'

# 4. Wait for navigation
python executor.py --tool wait_for --args '{"selector": "#dashboard", "state": "visible"}'
```

### Mobile Testing

```bash
# 1. Emulate mobile device
python executor.py --tool emulate --args '{"device": "iPhone 12"}'

# 2. Navigate and test
python executor.py --tool navigate_page --args '{"url": "https://myapp.com"}'

# 3. Take mobile screenshot
python executor.py --tool take_screenshot --args '{"fullPage": true}'
```

## Configuration

MCP server configuration stored in `config.json`:
- **Command**: `npx chrome-devtools-mcp@latest`
- **Flags**: `--headless`, `--channel`, `--browser-url`, `--isolated`

### Headless Mode

```json
{
  "args": ["chrome-devtools-mcp@latest", "--headless"]
}
```

### Connect to Existing Chrome

```json
{
  "args": ["chrome-devtools-mcp@latest", "--browser-url", "http://localhost:9222"]
}
```

## Error Handling

**Common Issues:**
- Chrome not installed: Install Chrome or use `--channel` flag
- Element not found: Verify selector, use `wait_for` first
- Dialog blocking: Handle dialogs before continuing
- Timeout errors: Increase timeout or check page load

**Recovery:**
- Take screenshot to verify page state
- Check console for JavaScript errors
- List pages to ensure correct page is active
- Use evaluate_script for custom debugging

## Related

- Original MCP: `chrome-devtools-mcp@latest`
- Puppeteer Skill: `.claude/skills/puppeteer/`
- MCP Converter: `.claude/skills/mcp-converter/`

## Sources

- [Chrome DevTools MCP - npm](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Chrome DevTools MCP - GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Chrome DevTools MCP Blog](https://developer.chrome.com/blog/chrome-devtools-mcp)
