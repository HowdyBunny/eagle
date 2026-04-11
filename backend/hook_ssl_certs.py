"""
PyInstaller runtime hook — fix SSL certificate path inside the bundle.

When PyInstaller bundles the app, the certifi CA bundle is copied into
_MEIPASS/_internal, but Python's ssl module still looks for the certs at the
original installation path.  Setting SSL_CERT_FILE / REQUESTS_CA_BUNDLE /
CURL_CA_BUNDLE at startup tells every HTTPS library (httpx, urllib3, etc.)
to use the bundled certs instead of the missing system ones.
"""

import os
import sys

if getattr(sys, "frozen", False):
    # Running inside a PyInstaller bundle
    try:
        import certifi
        cert_path = certifi.where()
        os.environ.setdefault("SSL_CERT_FILE", cert_path)
        os.environ.setdefault("REQUESTS_CA_BUNDLE", cert_path)
        os.environ.setdefault("CURL_CA_BUNDLE", cert_path)
    except Exception:
        pass
