import base64
import hmac
import hashlib
import json
import datetime

def enc(d):
    return base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).decode().rstrip('=')

def sign(msg, key):
    return base64.urlsafe_b64encode(hmac.new(key.encode(), msg.encode(), hashlib.sha256).digest()).decode().rstrip('=')

h = enc({"alg": "HS256", "typ": "JWT"})
p = enc({
    "sub": "71c19b56-5d9a-47f4-9a61-fa58ca17a546",
    "email": "admin@vantdomus.cl",
    "iat": int(datetime.datetime.now().timestamp()),
    "exp": int((datetime.datetime.now() + datetime.timedelta(days=3650)).timestamp())
})

msg = f"{h}.{p}"
s = sign(msg, "CHANGE_ME_SUPER_SECRET")
print(f"{msg}.{s}")
