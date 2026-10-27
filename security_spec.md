# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path outside `/exports/{exportId}` and `/exports/{exportId}/rows/{rowId}` is unconditionally denied (`allow read, write: if false`).
2. **Verified Identity Invariant**: Every read and write operation requires an authenticated user with `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Ownership Invariant (`ExportBatch`)**:
   - An `/exports/{exportId}` document can only be created with `ownerId == request.auth.uid`, `status == 'staging'`, `createdAt == request.time`, and `updatedAt == request.time`.
   - Only the document owner (`resource.data.ownerId == request.auth.uid`) can `get`, `list`, `update`, or `delete` their `ExportBatch`.
4. **Terminal State & Action-Based Transition Invariant (`ExportBatch`)**:
   - Updates on `/exports/{exportId}` are strictly permitted ONLY while `existing().status == 'staging'`.
   - Once `status` transitions to `'completed'` or `'failed'`, the document is terminally locked and cannot be updated again.
   - `ownerId`, `datasetKey`, `fileName`, and `createdAt` are immutable across updates; `updatedAt` must equal `request.time`.
   - Only two named update actions exist:
     - `CompleteExport`: `status == 'completed'` affecting only `['status', 'rowCount', 'hitCount', 'updatedAt']`.
     - `FailExport`: `status == 'failed'` affecting only `['status', 'updatedAt']`.
5. **Master Gate & Relational Sync Invariant (`ExportRow`)**:
   - An `/exports/{exportId}/rows/{rowId}` document cannot be created unless the parent `/exports/{exportId}` document exists, belongs to `request.auth.uid`, is currently in `status == 'staging'`, and shares the exact same `datasetKey`.
   - `incoming().exportId` must equal the path parameter `exportId`, `incoming().ownerId` must equal `request.auth.uid`, and `incoming().createdAt` must equal `request.time`.
   - `ExportRow` documents are immutable (`allow update: if false`).
   - Single-document `get` and `delete` verify both `existing().ownerId == request.auth.uid` and parent ownership via `get(/exports/$(exportId))`.
   - Collection `list` enforces `resource.data.ownerId == request.auth.uid && resource.data.exportId == exportId` without `get()`/`exists()` calls to prevent O(n) read amplification.
6. **Zero-Shadow-Field & Volumetric Guard Invariant**:
   - Both `isValidExportBatch` and `isValidExportRow` enforce `hasAll` and `hasOnly` on document keys, bounded `.size()` on every string, map, and list, integer range checks, and strict regex ID validation `^[a-zA-Z0-9_\-]+$`.
   - Zero PII (no emails, phone numbers, or addresses) is stored in Firestore.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Unauthenticated Export Creation**: `auth = null` attempting `create` on `/exports/exp_01`.
2. **Payload 2 — Unverified Email Spoofing**: `auth = { uid: 'user_1', email_verified: false }` attempting `create` on `/exports/exp_01`.
3. **Payload 3 — Identity Spoofing (`ownerId` Mismatch)**: `auth.uid = 'attacker_1'` creating `/exports/exp_01` with `ownerId: 'victim_1'`.
4. **Payload 4 — Shadow / Ghost Field Injection on Create**: Creating `/exports/exp_01` with extra key `"isAdmin": true`.
5. **Payload 5 — State Shortcutting on Create**: Creating `/exports/exp_01` directly in terminal `status: "completed"` instead of `"staging"`.
6. **Payload 6 — Forged Client Timestamp**: Creating `/exports/exp_01` where `createdAt != request.time`.
7. **Payload 7 — ID Poisoning Attack**: Creating `/exports/{200_char_malicious_id$#@!}` violating `isValidId()`.
8. **Payload 8 — Terminal State Re-Opening**: Updating `/exports/exp_01` when `existing().status == 'completed'` back to `'staging'` or modifying `rowCount`.
9. **Payload 9 — Immutable Field Mutation on Update**: Updating `/exports/exp_01` (`status: 'staging' -> 'completed'`) while mutating `datasetKey` or `ownerId`.
10. **Payload 10 — Orphaned Subcollection Write**: Creating `/exports/nonexistent_exp/rows/row_0001` where parent `/exports/nonexistent_exp` does not exist or belongs to another user or is already `'completed'`.
11. **Payload 11 — Unbounded Array / String Denial-of-Wallet**: Creating `/exports/exp_01/rows/row_0001` with 150 items in `matches` (exceeding max 100) or a 5,000-char `qaComment` (exceeding max 2000).
12. **Payload 12 — Cross-Tenant List / Read Scraping**: `auth.uid = 'attacker_1'` attempting `list` or `get` on `/exports` or `/exports/exp_01/rows` where `resource.data.ownerId == 'victim_1'`.

---

## 3. Red Team Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource / Value Poisoning | Shadow Update | Query Trust |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/exports/{exportId}` | Blocked (`data.ownerId == request.auth.uid` + immutable check) | Blocked (`create` requires `'staging'`; `update` requires `existing().status == 'staging'`) | Blocked (`isValidId` + `isValidExportBatch` wraps `create` & `update` with `.size()` and `int` bounds) | Blocked (`hasOnly` in `isValidExportBatch` + `affectedKeys().hasOnly(...)`) | Blocked (`allow list` checks `resource.data.ownerId == request.auth.uid`) |
| `/exports/{exportId}/rows/{rowId}` | Blocked (`data.ownerId == request.auth.uid` + `isParentExportStaging`) | Blocked (rows only creatable while parent is `'staging'`; `allow update: if false`) | Blocked (`isValidId` + `isValidExportRow` bounds every string, map, and `matches.size() <= 100`) | Blocked (`hasOnly` on all 19 keys; updates disabled) | Blocked (`allow list` checks `resource.data.ownerId == request.auth.uid && resource.data.exportId == exportId`) |
