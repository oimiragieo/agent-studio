---
name: puppeteer
description: Browser automation with Puppeteer. Navigate pages, interact with elements, fill forms, take screenshots, and execute JavaScript. Converted from MCP server for 90%+ context savings.
context:fork: true
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Start with puppeteer_navigate before other operations
  - Use puppeteer_screenshot to verify page state
  - Wait for elements to load before interacting
  - Handle navigation timing with launchOptions
  - Use puppeteer_evaluate for complex JavaScript operations
error_handling: graceful
streaming: supported
---

# Puppeteer Skill

## Overview

This skill provides browser automation capabilities using Puppeteer, a Node.js library for controlling headless Chrome/Chromium browsers. It enables page navigation, element interaction, form filling, screenshot capture, and JavaScript execution.

**Context Savings**: ~97% reduction
- **MCP Mode**: ~15,000 tokens always loaded
- **Skill Mode**: ~500 tokens metadata + on-demand loading

## When to Use

- Automated browser testing and QA workflows
- Web scraping and data extraction
- Form automation and submission
- Screenshot capture for visual testing
- JavaScript execution in browser context
- Dropdown/select element automation
- Hover state testing and interaction

## Quick Reference

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `puppeteer_navigate` | Navigate to URL | `url`, `launchOptions`, `allowDangerous` |
| `puppeteer_screenshot` | Capture page/element | `name`, `selector`, `width`, `height`, `encoded` |
| `puppeteer_click` | Click element | `selector` |
| `puppeteer_fill` | Fill input field | `selector`, `value` |
| `puppeteer_select` | Select dropdown option | `selector`, `value` |
| `puppeteer_hover` | Hover over element | `selector` |
| `puppeteer_evaluate` | Execute JavaScript | `script` |

```bash
# List available tools
python executor.py --list

# Navigate to a page
python executor.py --tool puppeteer_navigate --args '{"url": "https://example.com"}'

# Take a screenshot
python executor.py --tool puppeteer_screenshot --args '{"name": "homepage"}'

# Fill a form field
python executor.py --tool puppeteer_fill --args '{"selector": "#email", "value": "user@example.com"}'
```

## Tools

### Navigation (1 tool)

#### puppeteer_navigate

Navigate to a URL and optionally configure browser launch options.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to navigate to |
| `launchOptions` | object | No | Puppeteer LaunchOptions. Browser restarts if changed. Example: `{ headless: true, args: ['--no-sandbox'] }` |
| `allowDangerous` | boolean | No | Allow dangerous LaunchOptions like `--no-sandbox`. Default: `false` |

**Example:**
```bash
# Basic navigation
python executor.py --tool puppeteer_navigate --args '{"url": "https://example.com"}'

# Navigation with headless mode
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://example.com",
  "launchOptions": {"headless": true}
}'

# Dangerous launch options (use with caution)
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://example.com",
  "launchOptions": {"args": ["--no-sandbox", "--disable-setuid-sandbox"]},
  "allowDangerous": true
}'
```

**Notes:**
- Changing `launchOptions` triggers browser restart
- `allowDangerous` must be `true` to use security-reducing flags like `--no-sandbox`
- Default `launchOptions` is `null` (uses Puppeteer defaults)

### Capture (1 tool)

#### puppeteer_screenshot

Take a screenshot of the current page or a specific element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name for the screenshot file |
| `selector` | string | No | CSS selector for specific element to capture |
| `width` | number | No | Viewport width in pixels (default: 800) |
| `height` | number | No | Viewport height in pixels (default: 600) |
| `encoded` | boolean | No | Return base64-encoded data URI instead of binary (default: false) |

**Example:**
```bash
# Full page screenshot
python executor.py --tool puppeteer_screenshot --args '{"name": "homepage"}'

# Specific element screenshot
python executor.py --tool puppeteer_screenshot --args '{
  "name": "header",
  "selector": "#main-header"
}'

# Custom viewport size
python executor.py --tool puppeteer_screenshot --args '{
  "name": "mobile-view",
  "width": 375,
  "height": 667
}'

# Base64-encoded screenshot
python executor.py --tool puppeteer_screenshot --args '{
  "name": "encoded-screenshot",
  "encoded": true
}'
```

**Notes:**
- Without `selector`, captures entire viewport
- `encoded: true` returns text (base64 data URI) instead of binary image
- Default viewport is 800x600px

### Interaction (4 tools)

#### puppeteer_click

Click an element on the page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for element to click |

**Example:**
```bash
# Click a button
python executor.py --tool puppeteer_click --args '{"selector": "#submit-button"}'

# Click a link
python executor.py --tool puppeteer_click --args '{"selector": "a[href='/login']"}'

# Click by class
python executor.py --tool puppeteer_click --args '{"selector": ".btn-primary"}'
```

#### puppeteer_fill

Fill out an input field with text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for input field |
| `value` | string | Yes | Text value to enter |

**Example:**
```bash
# Fill email field
python executor.py --tool puppeteer_fill --args '{
  "selector": "#email",
  "value": "user@example.com"
}'

# Fill password field
python executor.py --tool puppeteer_fill --args '{
  "selector": "input[type='password']",
  "value": "securePassword123"
}'

# Fill textarea
python executor.py --tool puppeteer_fill --args '{
  "selector": "textarea[name='message']",
  "value": "Hello, this is a test message."
}'
```

**Notes:**
- Works with `<input>` and `<textarea>` elements
- Clears existing value before filling
- Triggers input events (suitable for validation testing)

#### puppeteer_select

Select an option from a dropdown (`<select>` element).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for select element |
| `value` | string | Yes | Value attribute of option to select |

**Example:**
```bash
# Select country
python executor.py --tool puppeteer_select --args '{
  "selector": "#country",
  "value": "US"
}'

# Select from dropdown by ID
python executor.py --tool puppeteer_select --args '{
  "selector": "select[name='plan']",
  "value": "premium"
}'
```

**Notes:**
- Works only with `<select>` elements
- Matches the `value` attribute of `<option>` elements, not visible text
- Triggers change events

#### puppeteer_hover

Hover over an element to trigger hover states.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for element to hover |

**Example:**
```bash
# Hover over navigation menu
python executor.py --tool puppeteer_hover --args '{"selector": ".nav-dropdown"}'

# Hover to reveal tooltip
python executor.py --tool puppeteer_hover --args '{"selector": ".info-icon"}'

# Hover for dropdown menu
python executor.py --tool puppeteer_hover --args '{"selector": "#user-menu"}'
```

**Notes:**
- Useful for testing hover states and dropdown menus
- Does not click the element
- Can be combined with screenshot to verify hover effects

### JavaScript Execution (1 tool)

#### puppeteer_evaluate

Execute arbitrary JavaScript code in the browser console context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `script` | string | Yes | JavaScript code to execute |

**Example:**
```bash
# Get page title
python executor.py --tool puppeteer_evaluate --args '{"script": "document.title"}'

# Get element count
python executor.py --tool puppeteer_evaluate --args '{
  "script": "document.querySelectorAll(\".product-card\").length"
}'

# Scroll to bottom
python executor.py --tool puppeteer_evaluate --args '{
  "script": "window.scrollTo(0, document.body.scrollHeight)"
}'

# Get local storage
python executor.py --tool puppeteer_evaluate --args '{
  "script": "JSON.stringify(localStorage)"
}'

# Inject CSS
python executor.py --tool puppeteer_evaluate --args '{
  "script": "const style = document.createElement(\"style\"); style.textContent = \"body { background: red; }\"; document.head.appendChild(style);"
}'
```

**Notes:**
- Runs in page context, not Node.js context
- Has access to DOM, window, and page-level JavaScript
- Return values are serialized to JSON
- Useful for complex operations not covered by other tools

## Common Workflows

### Login Flow Automation

```bash
# 1. Navigate to login page
python executor.py --tool puppeteer_navigate --args '{"url": "https://myapp.com/login"}'

# 2. Fill email field
python executor.py --tool puppeteer_fill --args '{"selector": "#email", "value": "user@example.com"}'

# 3. Fill password field
python executor.py --tool puppeteer_fill --args '{"selector": "#password", "value": "securePass123"}'

# 4. Click submit button
python executor.py --tool puppeteer_click --args '{"selector": "button[type=\"submit\"]"}'

# 5. Take screenshot of result
python executor.py --tool puppeteer_screenshot --args '{"name": "login-result"}'
```

### Form Submission

```bash
# 1. Navigate to form
python executor.py --tool puppeteer_navigate --args '{"url": "https://myapp.com/contact"}'

# 2. Fill name
python executor.py --tool puppeteer_fill --args '{"selector": "#name", "value": "John Doe"}'

# 3. Fill email
python executor.py --tool puppeteer_fill --args '{"selector": "#email", "value": "john@example.com"}'

# 4. Select reason dropdown
python executor.py --tool puppeteer_select --args '{"selector": "#reason", "value": "support"}'

# 5. Fill message
python executor.py --tool puppeteer_fill --args '{"selector": "#message", "value": "I need help with my account."}'

# 6. Submit form
python executor.py --tool puppeteer_click --args '{"selector": "#submit"}'
```

### Visual Regression Testing

```bash
# 1. Navigate to page
python executor.py --tool puppeteer_navigate --args '{"url": "https://myapp.com"}'

# 2. Capture baseline screenshot
python executor.py --tool puppeteer_screenshot --args '{"name": "baseline-homepage"}'

# 3. Hover over element to test hover state
python executor.py --tool puppeteer_hover --args '{"selector": ".nav-item"}'

# 4. Capture hover state
python executor.py --tool puppeteer_screenshot --args '{"name": "hover-state-nav"}'

# 5. Click to reveal modal
python executor.py --tool puppeteer_click --args '{"selector": ".open-modal"}'

# 6. Capture modal state
python executor.py --tool puppeteer_screenshot --args '{"name": "modal-open", "selector": ".modal"}'
```

### Data Extraction

```bash
# 1. Navigate to page
python executor.py --tool puppeteer_navigate --args '{"url": "https://news.ycombinator.com"}'

# 2. Extract headlines using JavaScript
python executor.py --tool puppeteer_evaluate --args '{
  "script": "Array.from(document.querySelectorAll(\".titleline > a\")).map(a => a.textContent).slice(0, 10)"
}'

# 3. Get page metadata
python executor.py --tool puppeteer_evaluate --args '{
  "script": "{title: document.title, url: window.location.href, description: document.querySelector(\"meta[name=description]\")?.content}"
}'
```

### Dropdown Menu Testing

```bash
# 1. Navigate to page
python executor.py --tool puppeteer_navigate --args '{"url": "https://myapp.com"}'

# 2. Hover over menu to reveal dropdown
python executor.py --tool puppeteer_hover --args '{"selector": "#nav-products"}'

# 3. Take screenshot of dropdown
python executor.py --tool puppeteer_screenshot --args '{"name": "products-dropdown"}'

# 4. Click dropdown item
python executor.py --tool puppeteer_click --args '{"selector": "#nav-products .dropdown-item:nth-child(2)"}'
```

### Mobile Viewport Testing

```bash
# 1. Navigate with mobile viewport
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://myapp.com",
  "launchOptions": {
    "defaultViewport": {"width": 375, "height": 667, "isMobile": true}
  }
}'

# 2. Take mobile screenshot
python executor.py --tool puppeteer_screenshot --args '{
  "name": "mobile-view",
  "width": 375,
  "height": 667
}'

# 3. Test mobile menu interaction
python executor.py --tool puppeteer_click --args '{"selector": ".mobile-menu-toggle"}'

# 4. Capture mobile menu state
python executor.py --tool puppeteer_screenshot --args '{"name": "mobile-menu-open"}'
```

## Configuration

MCP server configuration stored in `config.json`:
- **Command**: `npx`
- **Args**: `["-y", "@modelcontextprotocol/server-puppeteer"]`

### Headless Mode

By default, Puppeteer runs in headless mode. To run with visible browser:

```bash
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://example.com",
  "launchOptions": {"headless": false}
}'
```

### Custom Browser Arguments

```bash
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://example.com",
  "launchOptions": {
    "args": ["--window-size=1920,1080", "--disable-gpu"],
    "headless": true
  }
}'
```

### Dangerous Launch Options

Some options reduce security and require `allowDangerous: true`:

```bash
python executor.py --tool puppeteer_navigate --args '{
  "url": "https://example.com",
  "launchOptions": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  "allowDangerous": true
}'
```

**Warning:** Use `--no-sandbox` only in trusted environments. It disables Chrome's security sandbox.

## Error Handling

**Common Issues:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Navigation timeout" | Page took too long to load | Increase timeout in `launchOptions` or check network |
| "Element not found" | Selector doesn't match any element | Verify selector, check if element is dynamic |
| "Element not visible" | Element is hidden or off-screen | Scroll to element or wait for visibility |
| "Cannot set property" | Trying to fill non-input element | Verify selector targets `<input>` or `<textarea>` |
| "Browser launch failed" | Chrome/Chromium not found | Install Chrome or set `executablePath` in `launchOptions` |
| "Dangerous option rejected" | Using `--no-sandbox` without flag | Add `"allowDangerous": true` to args |

**Recovery Strategies:**

1. **Take screenshot to verify page state**
   ```bash
   python executor.py --tool puppeteer_screenshot --args '{"name": "debug"}'
   ```

2. **Use evaluate to check element existence**
   ```bash
   python executor.py --tool puppeteer_evaluate --args '{
     "script": "!!document.querySelector(\"#my-element\")"
   }'
   ```

3. **Add delays with evaluate**
   ```bash
   python executor.py --tool puppeteer_evaluate --args '{
     "script": "new Promise(resolve => setTimeout(resolve, 2000))"
   }'
   ```

4. **Check console logs with evaluate**
   ```bash
   python executor.py --tool puppeteer_evaluate --args '{
     "script": "console.log(\"Debug checkpoint reached\")"
   }'
   ```

## Comparison: Puppeteer vs Chrome DevTools Skill

| Feature | Puppeteer | Chrome DevTools |
|---------|-----------|-----------------|
| **Tools** | 7 | 26 |
| **Navigation** | Basic | Advanced (multi-page, wait conditions) |
| **Screenshots** | Yes (element/full) | Yes (element/full/format options) |
| **Performance** | No | Yes (tracing, analysis, insights) |
| **Network Inspection** | No | Yes (request/response details) |
| **Console Access** | Via evaluate | Direct (list, filter, retrieve) |
| **Form Automation** | Yes (fill, select, click) | Yes (fill, fill_form, upload) |
| **Hover Support** | Yes | Yes |
| **JavaScript Execution** | Yes (evaluate) | Yes (evaluate_script) |
| **Device Emulation** | Via launchOptions | Direct (emulate tool) |
| **Use Case** | Simpler automation, form testing | Advanced debugging, performance, network analysis |

**When to Choose Puppeteer:**
- Simple form automation workflows
- Basic screenshot capture
- Straightforward navigation and clicking
- Lightweight browser automation

**When to Choose Chrome DevTools:**
- Performance profiling and optimization
- Network request inspection
- Console message analysis
- Multi-page workflows
- Advanced debugging scenarios

## Related

- Chrome DevTools Skill: `.claude/skills/chrome-devtools/` (more advanced browser automation)
- Computer-Use Skill: `.claude/skills/computer-use/` (Playwright-based automation)
- Original MCP: `npx -y @modelcontextprotocol/server-puppeteer`
- MCP Converter: `.claude/skills/mcp-converter/`
- Skill Manager: `.claude/skills/skill-manager/`

## Sources

- [Puppeteer MCP Server - npm](https://www.npmjs.com/package/@modelcontextprotocol/server-puppeteer)
- [Puppeteer Documentation](https://pptr.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
