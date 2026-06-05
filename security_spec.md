# Firestore Security Specification

## 1. Data Invariants
- A `RevenueClosure` must belong to an authenticated user (`userId == request.auth.uid`).
- A `RevenueClosure`'s `remainingAmount` should dynamically represent `packageCost - cashPaid`.
- An `Expense` must belong to the authenticated user who created it.
- A `WorkingDaysConfig` can only be configured by the corresponding authenticated user.
- Any creation or update of timestamps (`createdAt`, `updatedAt`) must validate against `request.time`.

## 2. The "Dirty Dozen" Payloads (Aesthetic/Logic Violations)
1. **Unauthenticated Read**: Attempting to read entries in `users/{userId}/revenueClosures` without signing in.
2. **Identity Spoofing on Create**: Creating a closure under `userId: "malicious_user"` when signed in as `user_1`.
3. **Identity Spoofing on Update**: Modifying `userId` of an existing closure to point to another user.
4. **Illegal ID Characters**: Creating a document with ID `invalid@id!` (path variable hardening).
5. **Missing Required Fields**: Creating a closure with only `customerName` and no prices or billing types.
6. **Negative Monetary Values**: Setting `packageCost` or `amount` to a negative value.
7. **Invalid Payment Type**: Setting `paymentType` to `"Crypto"` instead of `Full Payment` or `EMI`.
8. **Malicious Giant String payload**: Injecting a 5MB string into `packageDetails` or `description`.
9. **Manipulated Relational Keys**: Infiltrating another user's collection or modifying the parent `userId`.
10. **Privilege Escalation**: Attempting to declare oneself as an administrator / write into admins collection when self-registering.
11. **Client Timestamp Forgery**: Forging a `createdAt` value which deviates from the server-validated `request.time`.
12. **Post-Closure Modification (Terminal Lock)**: Attempting to update a finalised/fully paid record to make modifications when not allowed, or editing unchangeable records.

## 3. Security Rules Drafting Configuration
We will enforce this via our standard ruleset, ensuring user isolation under standard `users/{userId}` paths.
