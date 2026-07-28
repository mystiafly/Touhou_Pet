import requests

url = "http://127.0.0.1:5000/api/characters/import"
file_path = "wriggle_test.zip"

with open(file_path, "rb") as f:
    files = {"file": ("wriggle_test.zip", f, "application/zip")}
    data = {"char_id": "wriggle_test"}
    try:
        response = requests.post(url, files=files, data=data)
        print("Status Code:", response.status_code)
        print("Response JSON:", response.json())
    except requests.exceptions.ConnectionError:
        print("Connection failed. Make sure the server is running on port 5000.")
