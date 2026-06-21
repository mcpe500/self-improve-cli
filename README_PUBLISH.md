# Publishing to NPM

## Prerequisites

1. NPM account: https://www.npmjs.com/signup
2. Login to npm: `npm login`
3. Verify: `npm whoami`

## Pre-Publish Checklist

- [x] Version updated in package.json (0.2.0)
- [x] CHANGELOG.md updated
- [x] All tests passing (122/122)
- [x] README.md complete
- [x] LICENSE added (MIT)
- [x] .npmignore configured
- [x] Keywords added to package.json
- [x] Repository URL added
- [x] Git commits use correct author (mcpe500)
- [x] Git tag v0.2.0 created

## Publish Steps

```bash
# 1. Final verification
npm test                    # 122 tests should pass
npm run check              # Same as npm test

# 2. Check what will be published
npm pack --dry-run

# 3. Login to npm (if not already)
npm login

# 4. Publish
npm publish

# For scoped package (if needed):
# npm publish --access public
```

## Post-Publish

```bash
# 1. Verify package is live
npm view self-improve-cli

# 2. Test installation
npm install -g self-improve-cli
sicli --version
sicli tui

# 3. Create GitHub release
# Go to: https://github.com/mcpe500/self-improve-cli/releases/new
# Tag: v0.2.0
# Title: v0.2.0 - TUI Mode & Config System
# Description: Copy from CHANGELOG.md
```

## Package Info

- **Name**: `self-improve-cli`
- **Version**: 0.2.0
- **Binary**: `sicli`
- **Node**: >=18
- **License**: MIT
- **Dependencies**: blessed (TUI library)

## Installation Commands (After Publish)

```bash
# Global install
npm install -g self-improve-cli

# Use immediately
sicli --version
sicli init
sicli tui
```

## Troubleshooting Publish

### "You do not have permission to publish"

```bash
# Check if package name is available
npm view self-improve-cli

# If taken, change name in package.json
# Or use scoped package: @mcpe500/self-improve-cli
```

### "Package name too similar"

```bash
# Try alternative names:
# - @mcpe500/self-improve-cli
# - sicli
# - self-improve-agent
```

### "402 Payment Required"

```bash
# For scoped packages, use --access public
npm publish --access public
```

## Update Package (Future)

```bash
# 1. Make changes
# 2. Update version
npm version patch  # 0.2.0 -> 0.2.1
npm version minor  # 0.2.0 -> 0.3.0
npm version major  # 0.2.0 -> 1.0.0

# 3. Commit and tag
git push && git push --tags

# 4. Publish
npm publish
```

## Metrics to Track

- npm downloads: https://npmjs.com/package/self-improve-cli
- GitHub stars: https://github.com/mcpe500/self-improve-cli
- GitHub issues: https://github.com/mcpe500/self-improve-cli/issues
- Test coverage: 122/122 tests passing
