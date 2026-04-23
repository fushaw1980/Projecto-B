# Security Specification for Biscate Directo

## Data Invariants
- A User profile must match the `request.auth.uid`.
- A Job can only be created by a Client.
- A Client can only see their own Jobs.
- A Worker can see Jobs assigned to them (`providerId`) or public alerts if their role is worker.
- Only an Admin can validate transactions.
- Messages are restricted to the job's client and provider.
- Reviews can only be created by the job's client after completion.

## The Dirty Dozen Payloads (Targeted for Rejection)
1.  **Attempt to create a user profile for a different UID.**
2.  **Client attempting to update a Job's status to 'PAGO' without Admin approval.**
3.  **Worker attempting to update `verified` status on their own profile.**
4.  **Injecting a 1MB string into the `fullName` field.**
5.  **Attempting to read a Job that doesn't belong to the user.**
6.  **Sending a Message to a Job the user isn't involved in.**
7.  **Updating `amount` on a Job after it has been created.**
8.  **Anonymous user attempting to create a Job.**
9.  **Unverified email user attempting to perform a write.**
10. **Deleting a completed Job.**
11. **Spoofing `updatedAt` with a client-provided past timestamp.**
12. **Setting own role to 'admin' during registration.**

## Rules Implementation Strategy
- Use `isValidUser`, `isValidJob`, `isValidMessage`, `isValidReview` helpers.
- Tiered access: Client vs Worker vs Admin.
- Terminal state locking for Jobs.
