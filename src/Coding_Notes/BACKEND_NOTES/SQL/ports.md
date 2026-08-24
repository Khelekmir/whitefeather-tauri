You're dealing with **two separate servers**:  
1. **Spring Boot Backend** (runs on port `8080` by default, but can be changed)  
2. **React Frontend** (runs on port `3000` by default, but can also be changed)  

### **1. What Ports Can They Be?**
- **Spring Boot Backend:** Typically runs on `8080`, so set this in `application.yaml`:  
  ```yaml
  server:
    address: 0.0.0.0
    port: 8080
  ```
  - `0.0.0.0` makes it accessible from anywhere on your local network.
  - If another process is using `8080`, you can try `8081`, `5000`, etc.

- **React Frontend:** Defaults to `3000`, so keep it as is.

- **React's `package.json` Proxy:** Should point to the **backend**:
  ```json
  "proxy": "http://localhost:8080"
  ```
  - This ensures that React requests (`fetch('/api/...')`) are forwarded to the backend.

### **2. How They Communicate**
| Component       | Port  | Description |
|---------------|------|-------------|
| **React (Frontend)** | `3000` | Runs the UI, sends requests to `8080`. |
| **Spring Boot (Backend)** | `8080` | Processes API requests from `3000`. |
| **PostgreSQL (Database)** | `5432` | Spring Boot connects to this for data. |

### **3. What Needs to Match?**
- **Backend `server.port`** in `application.yaml` → **Frontend `proxy`** in `package.json`
- **Frontend requests** (`fetch('/api/...')`) should resolve correctly based on proxy.

### **4. Example API Call in React**
If `proxy` is set, React can call the backend **without specifying `localhost:8080`**:

```javascript
fetch('/api/characters')
  .then(response => response.json())
  .then(data => console.log(data));
```

This **automatically** routes to `http://localhost:8080/api/characters`.

---

### **5. Alternative Port Configuration**
If **8080 is unavailable**, pick another port:
- **Backend:**
  ```yaml
  server:
    port: 5000
  ```
- **Frontend `package.json` Proxy:**
  ```json
  "proxy": "http://localhost:5000"
  ```

Let me know if anything is unclear! 🚀