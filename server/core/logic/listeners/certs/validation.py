def sanitize_cert(cert: dict, required: bool = False) -> dict:
    # Checks the certificate fields and strips them
    if not cert:
        if required:
            raise ValueError("certificate is required")
        return {}

    if not cert.get("enabled", True) and not required:
        return cert

    source = cert.get("source", "self_signed")
    if source == "manual":
        cert_pem = str(cert.get("certPem") or "").strip()
        key_pem = str(cert.get("keyPem") or "").strip()
        if "BEGIN CERTIFICATE" not in cert_pem or "PRIVATE KEY" not in key_pem:
            raise ValueError("invalid certificate or key")
        return {"enabled": True, "source": "manual", "certPem": cert_pem, "keyPem": key_pem}

    def subj(value, default):
        # Strips a subject field and rejects it when it is empty
        text = str(value or default).strip().replace("/", "")[:64]
        if not text:
            raise ValueError("invalid subject field")
        return text

    country = str(cert.get("country") or "US").strip().upper()
    if len(country) != 2 or not country.isalpha():
        raise ValueError("country must be 2 letters")

    cn = subj(cert.get("commonName"), "localhost")
    san = str(cert.get("sanDns") or cn).strip()[:253]
    if not san:
        raise ValueError("invalid DNS name")

    key_type = str(cert.get("keyType") or "ecdsa").lower()
    if key_type not in ("rsa", "ecdsa"):
        key_type = "ecdsa"

    try:
        days = int(cert.get("days") or 397)
    except (TypeError, ValueError):
        raise ValueError("invalid days")
    return {
        "enabled": True,
        "source": "self_signed",
        "country": country,
        "state": subj(cert.get("state"), "California"),
        "locality": subj(cert.get("locality"), "San Jose"),
        "organization": subj(cert.get("organization"), "Local Org"),
        "orgUnit": subj(cert.get("orgUnit"), "IT"),
        "commonName": cn,
        "sanDns": san,
        "keyType": key_type,
        "days": min(max(days, 1), 3650),
    }
