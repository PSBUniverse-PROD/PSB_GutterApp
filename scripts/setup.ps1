# setup.ps1 — One-time setup for new developers or fresh clones
# Usage: .\scripts\setup.ps1
#
# This script:
#   1. Connects the core remote (if missing) with push disabled
#   2. Installs npm packages (if node_modules is missing)
#   3. Creates .env.local with template (if missing)
#   4. Adds VS Code read-only rules for protected folders (module repos only)
#
# If everything is already set up, the script does nothing.

Write-Host "`n=== PSBUniverse Setup ===" -ForegroundColor Cyan

$allGood = $true

# Detect repo type by remote count:
#   - 1 remote whose URL contains "PSBUniverse-core" = core repo (senior dev, push allowed)
#   - 1 remote pointing elsewhere = fresh module clone (needs core remote added)
#   - 2+ remotes = module repo already set up (has origin + core)
$allRemotes = @(git remote 2>$null)
$isModuleRepo = $true

if ($allRemotes.Count -eq 1) {
    $url = git remote get-url $allRemotes[0] 2>$null
    if ($url -match "PSBUniverse-core") {
        $isModuleRepo = $false
    }
}
# If 2+ remotes, it's definitely a module repo (origin + core)

# ── 1. Core remote (module repos only) ─────────────────────────

if ($isModuleRepo) {
    $coreUrl = git remote get-url core 2>$null

    if (-not $coreUrl) {
        Write-Host "`n[1/4] Adding core remote..." -ForegroundColor Green
        git remote add core https://github.com/PSBUniverse-DEV/PSBUniverse-core.git
        git remote set-url --push core no_push_allowed
        Write-Host "  Core remote added (push disabled)." -ForegroundColor Gray
        $allGood = $false
    } else {
        # Ensure push is always disabled, even if someone reconfigured it
        $corePush = git remote get-url --push core 2>$null
        if ($corePush -ne "DISABLED" -and $corePush -ne "no_push_allowed") {
            git remote set-url --push core no_push_allowed
            Write-Host "[1/4] Core remote push URL re-locked." -ForegroundColor Yellow
            $allGood = $false
        } else {
            Write-Host "[1/4] Core remote OK." -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "[1/4] Core repo detected - core remote not needed." -ForegroundColor DarkGray
}

# ── 2. npm install ──────────────────────────────────────────────

if (-not (Test-Path "node_modules")) {
    Write-Host "`n[2/4] Installing packages..." -ForegroundColor Green
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: npm install failed." -ForegroundColor Red
        exit 1
    }
    $allGood = $false
} else {
    Write-Host "[2/4] node_modules OK." -ForegroundColor DarkGray
}

# ── 3. .env.local ──────────────────────────────────────────────

if (-not (Test-Path ".env.local")) {
    Write-Host "`n[3/4] Creating .env.local template..." -ForegroundColor Green

    $template = @"
# Supabase keys — ask your senior dev for the actual values
# These come from the Supabase dashboard: Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Environment: local | dev | prod  (leave as local unless told otherwise)
NEXT_PUBLIC_ENV=local
"@
    $template | Set-Content -Path ".env.local" -Encoding UTF8
    Write-Host "  .env.local created with placeholder values." -ForegroundColor Yellow
    Write-Host "  IMPORTANT: Open .env.local and paste your real Supabase keys." -ForegroundColor Yellow
    Write-Host "  Ask your senior dev if you don't have them." -ForegroundColor Yellow
    $allGood = $false
} else {
    Write-Host "[3/4] .env.local OK." -ForegroundColor DarkGray
}

# ── 4. VS Code read-only rules (module repos only) ─────────────

$settingsPath = ".vscode/settings.json"
$readonlyMarker = "files.readonlyInclude"

if ($isModuleRepo) {
    $needsReadonly = $true

    if (Test-Path $settingsPath) {
        $currentContent = Get-Content $settingsPath -Raw
        if ($currentContent -match [regex]::Escape($readonlyMarker)) {
            $needsReadonly = $false
        }
    }

    if ($needsReadonly) {
        Write-Host "`n[4/4] Adding VS Code read-only rules for protected folders..." -ForegroundColor Green

        if (-not (Test-Path ".vscode")) {
            New-Item -ItemType Directory -Path ".vscode" -Force | Out-Null
        }

        if (Test-Path $settingsPath) {
            # Read existing settings, strip trailing closing brace, append readonly block
            $existing = Get-Content $settingsPath -Raw
            $existing = $existing.TrimEnd()

            # Remove the final } so we can append new properties
            if ($existing.EndsWith("}")) {
                $existing = $existing.Substring(0, $existing.LastIndexOf("}")).TrimEnd()
                # Add a comma after the last property if needed
                if (-not $existing.EndsWith(",") -and -not $existing.EndsWith("{")) {
                    $existing += ","
                }
            }

            $readonlyBlock = @"

  "files.readonlyInclude": {
    "**/src/core/**": true,
    "**/src/shared/**": true,
    "**/src/styles/**": true,
    "**/src/modules/admin/**": true,
    "**/src/modules/psbpages/**": true,
    "**/supabase/**": true,
    "**/config/**": true,
    "**/scripts/**": true,
    "**/docs/**": true
  }
}
"@
            $merged = $existing + $readonlyBlock
            $merged | Set-Content -Path $settingsPath -Encoding UTF8
        } else {
            # No existing settings file — create one with just readonly rules
            $fresh = @"
{
  "files.readonlyInclude": {
    "**/src/core/**": true,
    "**/src/shared/**": true,
    "**/src/styles/**": true,
    "**/src/modules/admin/**": true,
    "**/src/modules/psbpages/**": true,
    "**/supabase/**": true,
    "**/config/**": true,
    "**/scripts/**": true,
    "**/docs/**": true
  }
}
"@
            $fresh | Set-Content -Path $settingsPath -Encoding UTF8
        }

        Write-Host "  VS Code read-only rules added." -ForegroundColor Gray
        Write-Host "  Protected folders will appear as read-only in VS Code." -ForegroundColor Gray
        $allGood = $false
    } else {
        Write-Host "[4/4] VS Code read-only rules OK." -ForegroundColor DarkGray
    }
} else {
    Write-Host "[4/4] Core repo detected - skipping VS Code read-only rules." -ForegroundColor DarkGray
}

# ── Done ────────────────────────────────────────────────────────

if ($allGood) {
    Write-Host "`n=== Everything is already set up. Nothing to do. ===" -ForegroundColor Cyan
} else {
    Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
    if (-not (Test-Path ".env.local") -or (Get-Content ".env.local" -Raw) -match "your-project\.supabase\.co") {
        Write-Host "REMINDER: Update .env.local with your real Supabase keys before running the app." -ForegroundColor Yellow
    }
}
