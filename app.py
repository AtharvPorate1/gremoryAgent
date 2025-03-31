from flask import Flask, request, jsonify
import os
app = Flask(__name__)


USER = os.getenv("USER", "default_user")
BALANCE = os.getenv("BALANCE", "0")
SPECIAL_CODE = os.getenv("SPECIAL_CODE", "secret")

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"


@app.route("/check", methods=["GET"])
def check():
   
    # Get Authorization header
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split("Bearer ")[1]

    # Validate special code
    if token == SPECIAL_CODE:
        return jsonify({"user": USER, "balance": BALANCE})
    else:
        return jsonify({"error": "Unauthorized"}), 401
    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)