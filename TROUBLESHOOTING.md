# Troubleshooting Guide

## UI Shows Blank Page or Connection Errors

### Symptoms
- Blank page at `http://localhost:5173`
- Browser console shows: `GET http://localhost:3001/api/* net::ERR_CONNECTION_REFUSED`
- TypeScript errors about missing exports or type imports

### Root Cause Analysis
This issue had **multiple layers** that made it hard to diagnose:

1. **Primary Issue**: API server not running on port 3001
2. **Secondary Issues**: TypeScript compilation errors preventing builds
3. **Architectural Issue**: UI has hard dependency on API with no graceful degradation

### Why This Was Hard to Fix

#### 1. **Misleading Error Messages**
- Initial error: `'ApiResponse' is not provided by '/src/types/index.ts'`
- This suggested an import/export problem, but the real issue was the API server
- The TypeScript errors were real but not the cause of the blank page

#### 2. **Multiple Failure Modes**
The system could fail in several ways:
- TypeScript won't compile → Build fails
- API server not running → Runtime connection errors
- Wrong import syntax → Vite dev server errors

Each needed different fixes, making it unclear which to tackle first.

#### 3. **Tight Coupling**
- UI components immediately fetch from API on mount
- No fallback behavior when API is unavailable
- Dashboard waits for ALL data before rendering
- This creates a "all or nothing" failure mode

#### 4. **Workflow Confusion**
Three ways to run the app:
- `npm run ui:dev` - **FAILS** (no API server)
- `npm run server` + `npm run ui:dev` - **WORKS** (manual, 2 terminals)
- `npm run dev:all` - **SHOULD WORK** (but user reported it didn't)

The right workflow wasn't clear from the error messages.

### Correct Debugging Approach

Here's what should have been done **first**:

```bash
# 1. Check what's actually running
netstat -ano | findstr :3001  # Windows
lsof -i :3001                  # macOS/Linux

# 2. Test API directly
curl http://localhost:3001/api/health

# 3. Check TypeScript compilation
npm run build                  # Backend
cd ui && npm run build        # Frontend

# 4. Only THEN look at code issues
```

### The Fix (Step by Step)

1. **Fix TypeScript Errors First**
   ```bash
   npm run build  # Identify all compilation errors
   ```
   - Remove unused imports (`ScheduledListing` from api.ts)
   - Prefix unused parameters with `_` (`_req` instead of `req`)
   - Use `import type` for type-only imports (TypeScript `verbatimModuleSyntax`)

2. **Start API Server**
   ```bash
   npm run server  # Terminal 1
   ```

3. **Start UI Dev Server**
   ```bash
   npm run ui:dev  # Terminal 2
   ```

4. **OR Use Concurrent Mode**
   ```bash
   npm run dev:all  # Runs bot + API + UI together
   ```

### Prevention

#### For Developers Adding Features

1. **Always test the full stack**
   ```bash
   npm run dev:all  # Test everything together
   ```

2. **Check TypeScript before committing**
   ```bash
   npm run build && cd ui && npm run build
   ```

3. **Document runtime dependencies**
   - If UI needs API, state it clearly in README
   - Add health checks to detect missing services

#### For Better Architecture

**TODO**: Make UI resilient to missing API:

```typescript
// In Dashboard.tsx - handle API unavailable gracefully
if (activeError && activeError.includes('ERR_CONNECTION_REFUSED')) {
  return <ApiServerDownMessage />;
}
```

**TODO**: Add connection status indicator:
```typescript
const [apiAvailable, setApiAvailable] = useState(false);

useEffect(() => {
  fetch('http://localhost:3001/api/health')
    .then(() => setApiAvailable(true))
    .catch(() => setApiAvailable(false));
}, []);
```

### Lessons Learned

1. **Start with the runtime, not the code**
   - Check what's running: `netstat`, `lsof`, `ps`
   - Test endpoints: `curl`, browser network tab
   - Then look at code

2. **TypeScript errors != Runtime errors**
   - TS errors prevent builds
   - Runtime errors happen when things are running but broken
   - Fix TS first, then test runtime

3. **Follow the actual error message**
   - `ERR_CONNECTION_REFUSED` = server not running
   - `cannot find module` = import/path issue
   - `does not provide export` = export/import mismatch

4. **Test the happy path first**
   - Does `npm run dev:all` work? Start there.
   - If yes, break it down to find what's wrong
   - If no, fix that first before debugging UI

5. **Architecture matters**
   - Tight coupling creates fragile systems
   - Always provide fallbacks for external dependencies
   - Make failures visible and actionable

### Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Blank page + `ERR_CONNECTION_REFUSED` | API not running | `npm run server` |
| `does not provide export` | Wrong import syntax | Use `import type` for types |
| Build fails with TS errors | Unused vars, wrong types | Check `npm run build` output |
| `dev:all` doesn't work | Port conflicts, .env missing | Check ports, verify API keys |

## Common TypeScript Errors

### Error: "must be imported using a type-only import when 'verbatimModuleSyntax' is enabled"

**Cause**: TypeScript strict mode requires separating type imports from value imports.

**Fix**:
```typescript
// ❌ Wrong
import { SomeType } from './types';

// ✅ Correct
import type { SomeType } from './types';
```

### Error: "declared but its value is never read"

**Cause**: Unused imports or variables with `noUnusedLocals` enabled.

**Fix**:
```typescript
// ❌ Wrong - unused import
import { UnusedType } from './types';

// ✅ Fix 1 - Remove it
// (no import)

// ✅ Fix 2 - Prefix with underscore for intentionally unused params
app.get('/api/endpoint', async (_req, res) => {
  // _req signals "intentionally unused"
});
```

---

**Last Updated**: 2025-10-04
**Related Issues**: Scheduled listings feature, blank page on UI
