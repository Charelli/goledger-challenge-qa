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

> **Note:** Bugs were identified primarily in the Local API and Web layers. The external CCAPI was used as a reference to confirm the expected correct behaviour.

---

## Bug Summary

| ID | Title | Component | Severity |
|---|---|---|---|
| BUG-001 | JWT token not sent in authenticated requests | Web | Critical |
| BUG-002 | Local API does not handle CCAPI responses correctly (GET + POST) | API | High |
| BUG-003 | Web crashes when trying to read null response from API | Web | High |
| BUG-005 | API returns status 201 for failed operations | API | Critical |
| BUG-006 | bookType field sent as number instead of string | Web | High |
| BUG-007 | Local API does not forward request body correctly to CCAPI | API | Critical |
| BUG-008 | DELETE /books identifies asset by title and author instead of unique @key | API | High |
| BUG-009 | Web does not validate CPF before sending to API | Web | Medium |

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
In `api.ts`, intercept all requests and include the stored JWT token in the header:

```typescript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${localStorage.getItem("token")}`
}
```

---

### BUG-002

**Title:** Local API does not handle CCAPI responses correctly (GET + POST)  
**Component:** API  
**Endpoint / Page:** `GET /books`, `GET /libraries`, `POST /books`, `POST /persons`, `POST /libraries`  
**Severity:** High  

**Description:**  
The local API does not correctly process or return responses from the CCAPI in any operation. On creation endpoints (POST), the API returns status 201 with a null body instead of the created object. On listing endpoints (GET), the API returns an empty array even when assets exist on the blockchain. Both issues were confirmed by querying the external CCAPI directly, which returns all data correctly.

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
Review the CCAPI response handling in all endpoint handlers. Ensure the response body is correctly deserialized and returned to the client:

```go
// POST — return created object
c.JSON(http.StatusCreated, ccapiResponse.Result)

// GET — return asset list
c.JSON(http.StatusOK, ccapiResponse.Result)
```

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
In `api.ts` or the form handler, add null check before accessing response properties:

```typescript
if (response && response.error) {
  // handle error
} else {
  // handle success
}
```


---

---

### BUG-005

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
{ "error": "{"error":"failed to write asset to ledger: asset already exists","status":409}" }
```

> 📎 Evidence: `evidence/BUG-005.png`

**Proposed Fix:**  
Check the status returned by the CCAPI and forward it correctly to the client. Also deserialize the error body before returning:

```go
if ccapiResponse.Status != 200 {
  c.JSON(ccapiResponse.Status, gin.H{"error": ccapiResponse.Error})
  return
}
```

---

### BUG-006

**Title:** bookType field sent as number instead of string  
**Component:** Web  
**Endpoint / Page:** `POST /books` — Book creation page  
**Severity:** High  

**Description:**  
The book creation form displays type options (`hardcover`, `ebook`, `paperback`) but sends the corresponding value as an integer (e.g. `2`) instead of the text value (e.g. `"ebook"`), causing data inconsistency on the blockchain.

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

> 📎 Evidence: `evidence/BUG-006.png`

**Proposed Fix:**  
In the form component, map the selected value to the corresponding string before sending:

```typescript
const bookTypeMap = { 1: "hardcover", 2: "ebook", 3: "paperback" };
payload.bookType = bookTypeMap[selectedBookType];
```

---

### BUG-007

**Title:** Local API does not forward request body correctly to CCAPI  
**Component:** API  
**Endpoint / Page:** `POST /books`, `POST /libraries`, `POST /persons`  
**Severity:** Critical  

**Description:**  
The local API is not correctly forwarding request bodies to the external CCAPI. When trying to create a library, for example, the API returns `400 - missing argument 'name'` even when the `name` field is correctly sent in the payload. Creating the same asset directly on the external CCAPI works without errors.

**Steps to Reproduce:**  
1. Authenticate on the local Swagger  
2. Execute `POST /libraries` with payload `{"name": "Central Library"}`  
3. Check the error returned  
4. Execute the same asset creation directly on the external CCAPI via `POST /api/invoke/createAsset`  
5. Compare the results  

**Expected Behaviour:**  
Library created successfully, matching the behaviour of the external CCAPI.

**Actual Behaviour:**  
`400` with `{"error": "{\"error\":\"missing argument 'name'\",\"status\":400}"}`.

> 📎 Evidence: `evidence/BUG-007.png`

**Proposed Fix:**  
Review the proxy handler in the local API. The request body must be correctly read, serialized in the format expected by the CCAPI and included in the forwarded request:

```go
body, _ := json.Marshal(map[string]interface{}{
  "asset": []interface{}{payload},
})
```

---

### BUG-008

**Title:** DELETE /books identifies asset by title and author instead of unique @key  
**Component:** API  
**Endpoint / Page:** `DELETE /books`  
**Severity:** High  

**Description:**  
The book deletion endpoint receives `title` and `author` as asset identifiers instead of using the unique `@key` generated by the blockchain. This is incorrect since multiple books with the same title and author can exist in the system, making deletion ambiguous and unreliable.

**Steps to Reproduce:**  
1. Create two books with the same title and author on the blockchain  
2. Try to delete one of them via `DELETE /books` providing title and author  
3. There is no way to distinguish which of the two will be deleted  

**Expected Behaviour:**  
Deletion endpoint receives the unique `@key` of the asset: `book:xxxx-xxxx-xxxx`.

**Actual Behaviour:**  
Endpoint receives `title` and `author` as identifiers, which may result in incorrect or ambiguous deletion.

> 📎 Evidence: `evidence/BUG-008.png`

**Proposed Fix:**  
Change the endpoint to receive the asset `@key`:

```go
key := c.Query("key") // e.g. "book:1963d04b-2db5-57ec-a7b6-182f653b705a"
```

---

### BUG-009

**Title:** CPF sent with formatting mask instead of digits only  
**Component:** Web  
**Endpoint / Page:** `POST /persons` — Person creation page  
**Severity:** Medium  

**Description:**  
The person creation form sends the CPF with punctuation (e.g. `895.812.520-96`) instead of only the 11 numeric digits. Even though the blockchain accepts and registers the asset, the null response body causes the Web to display a JavaScript error on screen, leaving the user confused about whether the operation succeeded or not.

**Steps to Reproduce:**  
1. Access the person creation page  
2. Enter a CPF with mask formatting (e.g. `895.812.520-96`)  
3. Fill in the remaining fields and click Register Person  
4. Observe the error message on screen despite the asset being created on the blockchain  

**Expected Behaviour:**  
CPF sent as `"89581252096"` (digits only) and a success message displayed to the user after registration.

**Actual Behaviour:**  
CPF sent as `"895.812.520-96"` (with mask). The blockchain registers the asset and returns 201, but the null response body causes the Web to display: `Cannot read properties of null (reading 'error')`, leaving the user unaware that the registration was successful.

> 📎 Evidence: `evidence/BUG-009.png`

**Proposed Fix:**  
Strip the CPF mask before sending the request:

```typescript
payload.cpf = cpf.replace(/\D/g, ""); // removes dots and dash
```

And display a success message independently of the response body:

```typescript
if (response === null || !response.error) {
  showSuccess("Person registered successfully!");
}
```

---

## Final Remarks

- The **external CCAPI works correctly** — all bugs are concentrated in the local API and Web layers.
- **BUG-001** and **BUG-007** are the root causes of most issues observed in the site — fixing these two will restore most of the application flow.
- **BUG-002** (null body + empty list) directly causes **BUG-003** and negatively impacts the usability of the entire application.
- Recommended fix priority order: **BUG-007 → BUG-001 → BUG-005 → BUG-002 → remaining bugs**.
