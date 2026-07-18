import requests
import json
import time

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"
TASK_ID = "a9aae91c950c466b6c6d8f76af9ee236"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def check_status():
    start_time = time.time()
    while time.time() - start_time < 300:
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={TASK_ID}", headers=HEADERS, timeout=10)
            res = r.json()
            if r.status_code == 200 and res.get("code") == 200:
                data = res.get("data", {})
                state = data.get("state")
                print(f"State: {state}")
                if state == "success":
                    print("Success! Response JSON:")
                    print(json.dumps(res, indent=2, ensure_ascii=False))
                    break
                elif state in ["fail", "error"]:
                    print("Failed:", data.get("failMsg"))
                    break
            else:
                print("Failed to request status:", res)
        except Exception as e:
            print("Error polling:", e)
        time.sleep(15)

if __name__ == "__main__":
    check_status()
