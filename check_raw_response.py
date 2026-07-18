import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

task_id = "16e3c58ec9b077fef00395c385fea55e"
response = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS)
print(json.dumps(response.json(), indent=2))
