import urllib.request
import urllib.error
import json

url = "https://vantdomus-backend.onrender.com/assistant/chat"
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NDY5ODY5My0xMGM4LTRlMGMtOTI4OS0xZjc4MTdlZGM5NDMiLCJlbWFpbCI6ImRlbW9AdmFudGRvbXVzLmNsIiwiaWF0IjoxNzczMTA3MjI0LCJleHAiOjIwODg0NjcyMjR9.WraUr0Oyvz2SYUzsI-zXnVabzbyZIW_vs1T99Pit7uI"

data = {
    "household_id": "288e2700-07df-4217-993a-3a4087ac3657",
    "messages": [{"role": "user", "content": "hola"}],
    "temperature": 0.2
}

req = urllib.request.Request(
    url,
    data=json.dumps(data).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read().decode())
except urllib.error.HTTPError as e:
    print(f"Error {e.code}:", e.read().decode())
except Exception as e:
    print("Other error:", str(e))
