import requests

url = "http://127.0.0.1:5000/api/characters/import"
files = {'file': open('wriggle_test.zip', 'rb')}
data = {'char_id': 'wriggle_test'}

response = requests.post(url, files=files, data=data)
print(response.status_code)
print(response.json())
