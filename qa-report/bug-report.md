# Bug Report — GoLedger Challenge QA Edition

**Author:** Charelli  
**Date:** 2026-04-05  
**Repository:** goledger-challenge-qa  
**Environment:** Local (Docker + npm dev server)

---

## System Architecture

```
Web (localhost:3000)
        ↓
Local API (localhost:8080)
        ↓
External CCAPI (ec2-54-196-90-7.compute-1.amazonaws.com)
        ↓
Blockchain (Hyperledger Fabric)
```

> **Note:** Bugs were identified in the Local API and Web layers. The external CCAPI was used as a reference to confirm the expected correct behaviour.

---

## Bug Summary

| ID | Title | Component | Severity |
|---|---|---|---|
| BUG-001 | JWT token not sent in authenticated requests | Web | Critical |
| BUG-002 | Local API does not handle CCAPI responses correctly (GET + POST) | API | High |
| BUG-003 | Web crashes when trying to read null response from API | Web | High |
| BUG-004 | API returns status 201 for failed operations | API | Critical |
| BUG-005 | bookType field sent as number instead of string | Web | High |
| BUG-006 | Local API does not forward request body correctly to CCAPI | API | Critical |
| BUG-007 | GET /me returns password in plain text | API | Critical |
| BUG-008 | GET /books requires author parameter — listing without filters not possible | API | High |
| BUG-009 | Pagination does not validate invalid parameters | API | Medium |
| BUG-010 | API accepts strings with no length limit | API | Low |
| BUG-011 | GET /persons endpoint does not exist | API | High |
| BUG-012 | Error messages expose internal blockchain details | API | High |
| BUG-013 | GET /libraries/{name}/books returns 400 instead of 404 for missing resource | API | Medium |
| BUG-014 | Broken Access Control — regular user can delete and create assets | API | Critical |
| BUG-015 | POST /auth/register is accessible by any authenticated user | API | Critical |

---

## Detailed Bug Reports

---

### BUG-001

**Title:** JWT token not sent in authenticated requests  
**Component:** Web  
**Endpoint / Page:** All authenticated pages (create book, person, library)  
**Severity:** Critical  

**Description:**  
After successfully logging in and receiving a JWT token, the Web does not include the token in the `Authorization` header of subsequent requests. All protected operations fail with a 401 error.

**Steps to Reproduce:**  
1. Access `http://localhost:3000`  
2. Log in with `admin / admin123`  
3. Navigate to the book creation page  
4. Fill in the fields and click to create  
5. Open DevTools > Network and check the request headers  

**Expected Behaviour:**  
Request sent with header `Authorization: Bearer <token>` and operation completed successfully.

**Actual Behaviour:**  
Request sent without the Authorization header. API returns `401 Unauthorized` with body `{"error": "authorization header required"}`.

> 📎 Evidence: `evidence/BUG-001.png`

**Proposed Fix:**  
The token is being saved after login but not included in subsequent requests. This should be reviewed with the development team to ensure the token is attached to every request header after authentication.

---

### BUG-002

**Title:** Local API does not handle CCAPI responses correctly (GET + POST)  
**Component:** API  
**Endpoint / Page:** `GET /books`, `GET /libraries`, `POST /books`, `POST /persons`, `POST /libraries`  
**Severity:** High  

**Description:**  
The local API does not correctly process or return responses from the CCAPI in any operation. On creation endpoints (POST), the API returns status 201 with a null body instead of the created object. On listing endpoints (GET), the API returns an empty array even when assets exist on the blockchain.

**Steps to Reproduce — Creation (POST):**  
1. Authenticate on the local Swagger `http://localhost:8080/docs/index.html`  
2. Execute `POST /books` with a valid payload  
3. Check the response body  

**Steps to Reproduce — Listing (GET):**  
1. Create a book directly via the external CCAPI using `POST /api/invoke/createAsset`  
2. Confirm the book exists via `POST /api/query/search` on the external CCAPI  
3. Call `GET /books` on the local API  

**Expected Behaviour:**  
- POST: returns the created object with status 201  
- GET: returns the list of all assets registered on the blockchain  

**Actual Behaviour:**  
- POST: returns `201` with body `null`  
- GET: returns `200` with body `[]`  

> 📎 Evidence: `evidence/BUG-002-post.png` / `evidence/BUG-002-get.png`

**Proposed Fix:**  
Review the CCAPI response handling in all endpoint handlers. The response body needs to be correctly deserialized and returned to the client instead of being discarded.

---

### BUG-003

**Title:** Web crashes when trying to read null response from API  
**Component:** Web  
**Endpoint / Page:** Create book, create person, create library pages  
**Severity:** High  

**Description:**  
Since the API returns `null` in the body of creation responses (BUG-002), the Web attempts to access the `.error` property of a null value, throwing an unhandled JavaScript exception displayed to the user.

**Steps to Reproduce:**  
1. Log in to the site  
2. Try to create a book or person with valid data  
3. Observe the error message on screen  

**Expected Behaviour:**  
Success message displayed to the user after asset creation.

**Actual Behaviour:**  
Error displayed on screen: `Cannot read properties of null (reading 'error')`.

> 📎 Evidence: `evidence/BUG-003.png`

**Proposed Fix:**  
The frontend should handle null or empty responses from the API gracefully instead of crashing. This should be reviewed with the development team to add proper null checks before accessing response properties.

---

### BUG-004

**Title:** API returns status 201 when asset already exists (conflict)  
**Component:** API  
**Endpoint / Page:** `POST /persons`  
**Severity:** Critical  

**Description:**  
When trying to create an asset that already exists on the blockchain, the CCAPI correctly returns `409 Conflict`. However, the local API forwards this as status `201`, completely misrepresenting the result of the operation. Additionally, the error body is double serialized — returned as an escaped JSON string inside another JSON object instead of a proper error object.

**Steps to Reproduce:**  
1. Authenticate on the local Swagger `http://localhost:8080/docs/index.html`  
2. Execute `POST /persons` with a CPF that already exists on the blockchain  
3. Check the status code and response body  

**Expected Behaviour:**  
`409 Conflict` with body:
```json
{ "error": "asset already exists", "status": 409 }
```

**Actual Behaviour:**  
`201 Created` with double serialized error body:
```json
{ "error": "{\"error\":\"failed to write asset to ledger: asset already exists\",\"status\":409}" }
```

> 📎 Evidence: `evidence/BUG-004.png`

**Proposed Fix:**  
The API should read the status code returned by the CCAPI and forward it correctly to the client instead of always returning 201. The error body also needs to be deserialized before being returned.

---

### BUG-005

**Title:** bookType field sent as number instead of string  
**Component:** Web  
**Endpoint / Page:** `POST /books` — Book creation page  
**Severity:** High  

**Description:**  
The book creation form sends the bookType value as an integer (e.g. `2`) instead of the text value (e.g. `"ebook"`), causing data inconsistency on the blockchain.

**Steps to Reproduce:**  
1. Access the book creation page  
2. Select an option in the Book Type field (e.g. "ebook")  
3. Open DevTools > Network  
4. Submit the form and check the request payload  

**Expected Behaviour:**  
```json
{ "bookType": "ebook" }
```

**Actual Behaviour:**  
```json
{ "bookType": 2 }
```

> 📎 Evidence: `evidence/BUG-005.png`

**Proposed Fix:**  
The form is sending the index of the selected option instead of its text value. This should be reviewed with the development team to ensure the bookType field sends the string value such as "ebook" instead of a number.

---

### BUG-006

**Title:** Local API does not forward request body correctly to CCAPI  
**Component:** API  
**Endpoint / Page:** `POST /books`, `POST /libraries`, `POST /persons`  
**Severity:** Critical  

**Description:**  
The local API is not correctly forwarding request bodies to the external CCAPI. When trying to create a library, the API returns `400 - missing argument 'name'` even when the `name` field is correctly sent in the payload.

**Steps to Reproduce:**  
1. Authenticate on the local Swagger  
2. Execute `POST /libraries` with payload `{"name": "Central Library"}`  
3. Check the error returned  
4. Execute the same asset creation directly on the external CCAPI via `POST /api/invoke/createAsset`  
5. Compare the results  

**Expected Behaviour:**  
Library created successfully.

**Actual Behaviour:**  
`400` with `{"error": "{\"error\":\"missing argument 'name'\",\"status\":400}"}`.

> 📎 Evidence: `evidence/BUG-006.png`

**Proposed Fix:**  
The request body is not being forwarded correctly to the CCAPI. This should be reviewed with the development team to ensure the payload is serialized in the format expected by the CCAPI before being sent.

---

### BUG-007

**Title:** GET /me returns user password in plain text  
**Component:** API  
**Endpoint / Page:** `GET /me`  
**Severity:** Critical  

**Description:**  
The profile endpoint returns the authenticated user's password in plain text in the response body. Passwords should never be returned by any API endpoint. This also suggests passwords are stored without hashing in the database, which is a critical security vulnerability.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login` with any valid credentials  
2. Call `GET /me` with the obtained token  
3. Check the response body  

**Expected Behaviour:**  
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin"
}
```

**Actual Behaviour:**  
```json
{
  "id": 1,
  "username": "admin",
  "password": "admin123",
  "role": "admin"
}
```

> 📎 Evidence: `evidence/BUG-007.png`

**Proposed Fix:**  
Remove the password field from the user response. Passwords should never be returned by any API endpoint and should be stored as a hash in the database, not in plain text.

---

### BUG-008

**Title:** GET /books requires author parameter — listing without filters not possible  
**Component:** API  
**Endpoint / Page:** `GET /books`  
**Severity:** High  

**Description:**  
The `GET /books` endpoint requires the `author` query parameter to be present. Without it, the API returns a 400 error. A listing endpoint should return all assets when no filters are provided.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `GET /books` without any query parameters  
3. Check the response  

**Expected Behaviour:**  
`200 OK` with list of all books.

**Actual Behaviour:**  
`400 Bad Request` with body:
```json
{ "error": "query parameter 'author' is required" }
```

> 📎 Evidence: `evidence/BUG-008.png`

**Proposed Fix:**  
Make the `author` parameter optional. When not provided, return all books.

---

### BUG-009

**Title:** Pagination does not validate invalid parameters  
**Component:** API  
**Endpoint / Page:** `GET /books`  
**Severity:** Medium  

**Description:**  
The API accepts invalid pagination parameters such as negative page numbers and zero limits without returning a validation error, returning an empty array instead.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `GET /books?author=test&page=-1&limit=0`  
3. Check the response  

**Expected Behaviour:**  
`400 Bad Request` with a validation error message.

**Actual Behaviour:**  
`200 OK` with body `[]`.

> 📎 Evidence: `evidence/BUG-009.png`

**Proposed Fix:**  
Add validation for pagination parameters before processing the request. Page and limit values below 1 should return a 400 error.

---

### BUG-010

**Title:** API accepts strings with no length limit  
**Component:** API  
**Endpoint / Page:** `POST /books`  
**Severity:** Low  

**Description:**  
The API accepts string fields with no maximum length validation. Sending an arbitrarily long string in the `title` field returns 201 with no error.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `POST /books` with a title containing hundreds of characters  
3. Check the response  

**Expected Behaviour:**  
`400 Bad Request` with a validation error for exceeding maximum length.

**Actual Behaviour:**  
`201` with body `null`.

> 📎 Evidence: `evidence/BUG-010.png`

**Proposed Fix:**  
Add maximum length validation to string fields so the API rejects inputs that exceed a reasonable limit.

---

### BUG-011

**Title:** GET /persons endpoint does not exist  
**Component:** API  
**Endpoint / Page:** `GET /persons`  
**Severity:** High  

**Description:**  
There is no endpoint to list persons registered on the blockchain. Only `POST /persons` exists for creation. The frontend has a persons listing page that cannot function without this endpoint.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `GET /persons`  
3. Check the response  

**Expected Behaviour:**  
`200 OK` with list of all persons.

**Actual Behaviour:**  
`404 page not found`.

> 📎 Evidence: `evidence/BUG-011.png`

**Proposed Fix:**  
Implement `GET /persons` endpoint following the same pattern as `GET /books`.

---

### BUG-012

**Title:** Error messages expose internal blockchain implementation details  
**Component:** API  
**Endpoint / Page:** Multiple endpoints  
**Severity:** High  

**Description:**  
When operations fail, the API returns detailed internal error messages from the blockchain layer, exposing implementation details such as internal function names, asset key generation logic, and ledger operations. This information should not be exposed to API consumers.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `PUT /books/tenant` with an invalid CPF  
3. Check the response body  

**Expected Behaviour:**  
```json
{ "error": "invalid tenant ID" }
```

**Actual Behaviour:**  
```json
{ "error": "{\"error\":\"unable to get args: invalid argument 'tenant': failed constructing key: error generating key for asset: failed to generate key for asset property 'CPF (Brazilian ID)': CPF must have 11 digits\",\"status\":400}" }
```

> 📎 Evidence: `evidence/BUG-012.png`

**Proposed Fix:**  
Intercept internal errors and return generic, user-friendly messages instead of raw blockchain error details.

---

### BUG-013

**Title:** GET /libraries/{name}/books returns 400 instead of 404 for missing resource  
**Component:** API  
**Endpoint / Page:** `GET /libraries/{name}/books`  
**Severity:** Medium  

**Description:**  
When requesting books from a library that does not exist, the API returns `400 Bad Request` instead of `404 Not Found`. A missing resource should always return 404.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login`  
2. Call `GET /libraries/doesnotexist/books`  
3. Check the status code  

**Expected Behaviour:**  
`404 Not Found`.

**Actual Behaviour:**  
`400 Bad Request` with body:
```json
{ "error": "{\"error\":\"failed to get asset from the ledger: failed to get asset bytes: asset not found\",\"status\":400}" }
```

> 📎 Evidence: `evidence/BUG-013.png`

**Proposed Fix:**  
The API should correctly map the status code from the CCAPI response. When an asset is not found, the response should be 404 Not Found, not 400 Bad Request.

---

### BUG-014

**Title:** Broken Access Control — regular user can delete and create assets  
**Component:** API  
**Endpoint / Page:** `DELETE /books`, `POST /books`, `POST /persons`, `POST /libraries`  
**Severity:** Critical  

**Description:**  
The API does not enforce role-based access control. A user with the `user` role can perform operations that should be restricted to `admin` only, such as deleting books and creating assets. This is a critical security vulnerability classified as Broken Access Control (OWASP Top 1).

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login` with `user1 / pass123`  
2. Call `DELETE /books` with a valid payload  
3. Call `POST /books` with a valid payload  
4. Check that both operations succeed  

**Expected Behaviour:**  
`403 Forbidden` — regular users should not be able to delete or create assets.

**Actual Behaviour:**  
Both operations succeed with status `200` / `201`.

> 📎 Evidence: `evidence/BUG-014.png`

**Proposed Fix:**  
Sensitive endpoints like DELETE and POST should check the user's role before allowing the operation. Only users with the admin role should be able to perform these actions. A middleware that validates the role before processing the request would solve this.

---

### BUG-015

**Title:** POST /auth/register is accessible by any authenticated user  
**Component:** API  
**Endpoint / Page:** `POST /auth/register`  
**Severity:** Critical  

**Description:**  
Any authenticated user, regardless of role, can create new user accounts via `POST /auth/register`. This endpoint should be restricted to admin users or require no authentication at all with proper controls such as email verification or invite-only registration.

**Steps to Reproduce:**  
1. Authenticate via `POST /auth/login` with `user1 / pass123`  
2. Call `POST /auth/register` with a new username and password  
3. Check that the new account is created successfully  

**Expected Behaviour:**  
`403 Forbidden` for non-admin users attempting to register new accounts.

**Actual Behaviour:**  
`200 OK` — new user account created successfully by a regular user.

> 📎 Evidence: `evidence/BUG-015.png`

**Proposed Fix:**  
Restrict the register endpoint to admin users using the same role-based middleware from BUG-014.

---

## Final Remarks

- The **external CCAPI works correctly** — all bugs are concentrated in the local API and Web layers.
- **BUG-007, BUG-014 and BUG-015** are critical security vulnerabilities that expose the system to unauthorized access and data leakage.
- **BUG-001** and **BUG-006** are the root causes of most functional issues observed in the frontend.
- **BUG-002** directly causes **BUG-003** and impacts the usability of the entire application.
- The double serialization pattern found in BUG-004 also appears in BUG-012 and BUG-013, suggesting a systemic issue in error handling across all endpoints.
- Recommended fix priority order: **BUG-014 → BUG-015 → BUG-007 → BUG-006 → BUG-001 → BUG-005 → BUG-002 → remaining bugs**.
