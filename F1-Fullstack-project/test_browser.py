from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

options = Options()
options.add_argument('--headless')
options.add_argument('--disable-gpu')
driver = webdriver.Chrome(options=options)

try:
    driver.get('http://localhost:5173/dashboard')
    time.sleep(3)
    logs = driver.get_log('browser')
    print("BROWSER CONSOLE LOGS:")
    for log in logs:
        print(log)
        
    body_text = driver.find_element("tag name", "body").text
    print("BODY TEXT LENGTH:", len(body_text))
    if len(body_text) < 100:
        print("BODY HTML:", driver.find_element("tag name", "body").get_attribute('innerHTML'))
except Exception as e:
    print("Error:", e)
finally:
    driver.quit()
