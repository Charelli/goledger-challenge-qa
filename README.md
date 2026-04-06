# GoLedger Challenge - QA Edition

In this challenge you will interact with a Hyperledger Fabric network through an already provided GoLang API and React front-end. Both the API and the front-end have been intentionally left with a number of issues and bugs. Your goal is to run both applications, explore their behaviour, and report every finding.

We recommend a UNIX-like machine (Linux/macOS).

## Prerequisites

| Tool | Version |
|---|---|
| [Docker](https://www.docker.com/) + [Docker Compose](https://docs.docker.com/compose/) | Latest |
| [Go](https://golang.org/dl/) | 1.21+ |
| [Node.js](https://nodejs.org/) | 18+ |

## Instructions

- Fork the repository [https://github.com/goledgerdev/goledger-challenge-qa](https://github.com/goledgerdev/goledger-challenge-qa)
  - Fork it, do **NOT** clone it, since you will need to send us your forked repository.
  - If you **cannot** fork it, create a **private** repository and give access to `andremacedopv` and `lucas-campelo`.
- Follow the setup steps below to run the API and the web application.
- Explore the running application and document every bug or unexpected behaviour you find.

## Repository structure

```
.
├── api/        # GoLang REST API (Gin) — proxies calls to the Hyperledger Fabric CCAPI
└── web/        # React front-end (Vite + TypeScript) — interacts with the API above
```

---

## Undertanding the underlying Hyperledger Fabric Network

The data are obtained using a rest server at this address, which stores the CCAPI, that communicates with the chaincode: `http://ec2-54-196-90-7.compute-1.amazonaws.com`

Also, a Swagger with the endpoints specifications for the operations is provided at this address: `http://ec2-54-196-90-7.compute-1.amazonaws.com/api-docs/index.html`.

Note: The API is protected with Basic Auth. The credentials were sent to you by email.

Tip: execute each operation in the Swagger for information on payload format and endpoint addresses. See examples below.

### Get Schema
Execute a `getSchema` operation to get information on which asset types are available. Don't forget to authenticate with the credentials provided.

```bash
curl -X POST "http://ec2-54-196-90-7.compute-1.amazonaws.com/api/query/getSchema" -H "accept: */*" -H "Content-Type: application/json"
```

Execute a getSchema with a payload to get more details on a particula asset.

```bash
curl -X POST "http://ec2-54-196-90-7.compute-1.amazonaws.com/api/query/getSchema" -H "accept: */*" -H "Content-Type: application/json" -d "{\"assetType\":\"book\"}"
```
Tip: the same can be done with transactions, using the `getTx` endpoint.

## Running the API

The API is a Go/Gin server that sits between the front-end and a Hyperledger Fabric CCAPI deployment. It exposes a Swagger UI so you can explore the available endpoints.

### 1. Configure environment variables

Copy the example env file and fill in the values:

```bash
cp api/.env.example api/.env
```

Open `api/.env` and set the three variables:

```env
# URL of the Hyperledger Fabric CCAPI
CCAPI_ORG_URL=http://ec2-54-196-90-7.compute-1.amazonaws.com

# HTTP Basic Auth credentials for the CCAPI
CCAPI_AUTH_USERNAME=<username_sent_by_email>
CCAPI_AUTH_PASSWORD=<password_sent_by_email>
```

> **Tip:** The CCAPI URL and credentials will be sent to you by e-mail. Keep them private and do not commit them to your repository.

### 2. Start the API

**Using Docker (recommended):**

```bash
cd api
docker-compose up --build
```

**Without Docker:**

```bash
cd api
go run .
```

The server will start on **http://localhost:8080**.

### 3. Explore the Swagger UI

A full OpenAPI specification is bundled with the API. Open your browser at:

```
http://localhost:8080/docs/index.html
```

### Default API credentials

The API ships with two pre-seeded user accounts for testing:

| Username | Password |
|---|---|
| `admin` | `admin123` |
| `user1` | `pass123` |

Use the `POST /auth/login` endpoint to obtain a JWT token, then click **Authorize** in the Swagger UI and paste the token to authenticate subsequent requests.

---

## Running the Web

The front-end is a React SPA that talks to the API above.

### 1. Configure environment variables

```bash
cp web/.env.example web/.env
```

If the API is running on a non-default address, edit `web/.env`:

```env
VITE_API_URL=http://localhost:8080
```

### 2. Install dependencies and start the dev server

```bash
cd web
npm install
npm run dev
```

The application will be available at **http://localhost:3000**.

---

## The Challenge

### Main deliverable — Bug Report

Your primary deliverable is a written bug report. It should be submitted as a **Markdown (`.md`) or PDF file** committed to your forked repository.

For **each bug or issue found**, the report must include:

| Field | Description |
|---|---|
| **ID** | A unique identifier for the bug (e.g. `BUG-001`) |
| **Title** | A short, descriptive title |
| **Component** | Which part of the system is affected (`API` or `Web`) |
| **Endpoint / Page** | The specific API endpoint or UI page where the issue occurs |
| **Severity** | `Critical` / `High` / `Medium` / `Low` |
| **Description** | What the bug is and why it is incorrect |
| **Steps to Reproduce** | Step-by-step instructions to trigger the issue |
| **Expected Behaviour** | What the correct behaviour should be |
| **Actual Behaviour** | What actually happens |
| **Proposed Fix** | A concrete suggestion for how the issue could be resolved (code snippet optional but appreciated) |

> **Tip:** Pay close attention to authentication flows, HTTP status codes, pagination logic, data submitted to the blockchain, and how sensitive information is handled.

### Optional deliverable — Automated Tests

As an optional but valued deliverable, you may submit automated tests that cover the available systems. These tests should demonstrate the incorrect behaviour and/or verify the expected behaviour.

Any testing suite is allowed.

Place the test files inside the respective `api/` or `web/` directory and include instructions on how to run them.

---

## Complete the challenge

To complete the challenge, send us the link to your **forked repository**. Make sure your bug report is committed and that any optional test code includes run instructions.

---

## Automated Tests

End-to-end tests written with Cypress covering BUG-001 and BUG-002.

### Requirements

- Node.js 18+
- API running on `http://localhost:8080`
- Web running on `http://localhost:3000`

### Install
```bash
cd web
npm install cypress --save-dev
```

### Run
```bash
npx cypress open
```

Select **E2E Testing** and run `create-book.cy.js`.