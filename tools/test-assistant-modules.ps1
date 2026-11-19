param([switch]$Backend)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    New-Item -ItemType Directory -Path 'tmp/app-audit' -Force | Out-Null
    $auditPlan = Get-Content 'server/assistant/testing/app-audit-plan.json' -Raw -Encoding utf8 | ConvertFrom-Json
    $env:ASSISTANT_MATRIX_MODULES = ($auditPlan.modules.key -join ',')
    $env:ASSISTANT_FUNCTION_MATRIX_OUTPUT = 'tmp/app-audit/validation.json'
    $env:ASSISTANT_FUNCTION_CONVERSATION_OUTPUT = 'tmp/app-audit/conversations.json'
    & node node_modules/vitest/vitest.mjs run server/assistant/function-matrix.test.ts server/assistant/function-conversation-matrix.test.ts --maxWorkers=2 --reporter=json --outputFile=tmp/app-audit/results.json
    $matrixExit = $LASTEXITCODE
    $backendExit = 0
    $nodeExit = 0
    if ($Backend) {
        $nodeTests = @(rg -l 'node:test' server/modules -g '*test.ts')
        $excludeArgs = @('--exclude', '**/function-matrix.test.ts', '--exclude', '**/function-conversation-matrix.test.ts')
        foreach ($nodeTest in $nodeTests) { $excludeArgs += @('--exclude', $nodeTest.Replace('\', '/')) }
        & node node_modules/vitest/vitest.mjs run server/assistant server/modules @excludeArgs --maxWorkers=4 --reporter=json --outputFile=tmp/app-audit/business-results.json
        $backendExit = $LASTEXITCODE
        & node --import tsx --test --test-concurrency=4 --test-reporter=tap @nodeTests *> tmp/app-audit/node-business.tap
        $nodeExit = $LASTEXITCODE
    }
    & node tools/assistant-module-audit.cjs
    $reportExit = $LASTEXITCODE
    if ($matrixExit -ne 0 -or $backendExit -ne 0 -or $nodeExit -ne 0 -or $reportExit -ne 0) { exit 1 }
} finally {
    Pop-Location
}
