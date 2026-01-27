# find-polluter.ps1 - Test Pollution Bisector (PowerShell version)
#
# PURPOSE:
# Identifies which test creates unwanted files, directories, or side effects.
# Uses sequential approach to find the polluting test among a test suite.
#
# WHEN TO USE:
# - Tests pass individually but fail when run together
# - Mysterious files appear after running tests
# - Test isolation issues cause flaky tests
# - Debugging shared state pollution
#
# USAGE:
#   .\find-polluter.ps1 -PollutionCheck <file_or_dir> -TestPattern <pattern>
#
# EXAMPLES:
#   .\find-polluter.ps1 -PollutionCheck ".git" -TestPattern "src\**\*.test.ts"
#   .\find-polluter.ps1 -PollutionCheck "temp.json" -TestPattern "tests\*.spec.js"
#
# INTEGRATION WITH DEBUGGING SKILL:
# This tool supports the systematic-debugging skill's Phase 1
# (Root Cause Investigation). Use it when you observe test pollution
# but don't know which test causes it.
#

param(
    [Parameter(Mandatory=$true)]
    [string]$PollutionCheck,

    [Parameter(Mandatory=$true)]
    [string]$TestPattern
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  Test Pollution Bisector"
Write-Host "========================================"
Write-Host ""
Write-Host "Searching for test that creates: $PollutionCheck"
Write-Host "Test pattern: $TestPattern"
Write-Host ""

# Get list of test files
$TestFiles = Get-ChildItem -Path $TestPattern -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName

if ($TestFiles.Count -eq 0) {
    Write-Host "ERROR: No test files found matching pattern: $TestPattern" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try a different pattern. Examples:"
    Write-Host "  'src\**\*.test.ts'    - TypeScript tests"
    Write-Host "  'tests\**\*.spec.js'  - JavaScript specs"
    exit 1
}

$Total = $TestFiles.Count
Write-Host "Found $Total test files"
Write-Host ""

# Check if pollution already exists
if (Test-Path $PollutionCheck) {
    Write-Host "WARNING: Pollution already exists before starting!" -ForegroundColor Yellow
    Write-Host "  File/Dir: $PollutionCheck"
    Write-Host ""
    Write-Host "Please remove it first:"
    Write-Host "  Remove-Item -Recurse -Force '$PollutionCheck'"
    Write-Host ""
    Write-Host "Then run this script again."
    exit 1
}

Write-Host "Starting bisection..."
Write-Host "----------------------------------------"

$Count = 0
foreach ($TestFile in $TestFiles) {
    $Count++
    $RelativePath = $TestFile.FullName

    Write-Host "[$Count/$Total] Testing: $RelativePath"

    # Run the test (suppress output, allow failures)
    try {
        $null = npm test $RelativePath 2>&1
    } catch {
        # Ignore test failures
    }

    # Check if pollution appeared
    if (Test-Path $PollutionCheck) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  POLLUTER FOUND!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Test file: $RelativePath" -ForegroundColor Yellow
        Write-Host "Created:   $PollutionCheck" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Pollution details:"
        Get-Item $PollutionCheck | Format-List
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "  1. Review the test: Get-Content $RelativePath"
        Write-Host "  2. Run in isolation: npm test $RelativePath"
        Write-Host "  3. Check for cleanup: Look for afterEach/afterAll"
        Write-Host "  4. Add cleanup if missing"
        Write-Host ""
        exit 1
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  No polluter found"
Write-Host "========================================"
Write-Host ""
Write-Host "All $Total tests ran without creating: $PollutionCheck"
Write-Host ""
Write-Host "Possible explanations:"
Write-Host "  1. Pollution requires multiple tests to trigger"
Write-Host "  2. Test pattern missed the polluting test"
Write-Host "  3. Pollution only happens in certain orders"
Write-Host ""
Write-Host "Try running all tests together and checking after:"
Write-Host "  npm test; Test-Path '$PollutionCheck'"
exit 0
