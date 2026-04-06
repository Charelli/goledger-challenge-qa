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
| BUG-004 | API returns status 201 for failed operations | API | Critical |
| BUG-005 | bookType field sent as number instead of string | Web | High |
| BUG-006 | Local API does not forward request body correctly to CCAPI | API | Critical |


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
{ "error": "{"error":"failed to write asset to ledger: asset already exists","status":409}" }
```

> 📎 Evidence: `evidence/BUG-004.png`

**Proposed Fix:**  
Check the status returned by the CCAPI and forward it correctly to the client. Also deserialize the error body before returning:

```go
if ccapiResponse.Status != 200 {
  c.JSON(ccapiResponse.Status, gin.H{"error": ccapiResponse.Error})
  return
}
```

---

### BUG-005

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

> 📎 Evidence: `evidence/BUG-005.png`

**Proposed Fix:**  
In the form component, map the selected value to the corresponding string before sending:

```typescript
const bookTypeMap = { 1: "hardcover", 2: "ebook", 3: "paperback" };
payload.bookType = bookTypeMap[selectedBookType];
```

---

### BUG-006

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

> 📎 Evidence: `evidence/BUG-006.png`

**Proposed Fix:**  
Review the proxy handler in the local API. The request body must be correctly read, serialized in the format expected by the CCAPI and included in the forwarded request:

```go
body, _ := json.Marshal(map[string]interface{}{
  "asset": []interface{}{payload},
})
```

---


## Final Remarks

- The **external CCAPI works correctly** — all bugs are concentrated in the local API and Web layers.
- **BUG-001** and **BUG-006** are the root causes of most issues observed in the site — fixing these two will restore most of the application flow.
- **BUG-002** (null body + empty list) directly causes **BUG-003** and negatively impacts the usability of the entire application.
- Recommended fix priority order: **BUG-006 → BUG-001 → BUG-005 → BUG-002 → remaining bugs**.
