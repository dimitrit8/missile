"""
Missile 3D Model Configuration
Maps missile/interceptor IDs to Google Drive links for GLB model loading.

HOW TO USE:
1. Upload your .glb files to Google Drive
2. Right-click each file → "Share" → set to "Anyone with the link can view"
3. Paste either:
   a) The full share URL:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
   b) Just the file ID:    FILE_ID   (the part between /d/ and /view)

The code handles both formats automatically.
"""

# Map missile/interceptor IDs to Google Drive share URLs or raw file IDs.
# You can paste the full share URL directly — no need to extract the ID manually.
# Key = missile ID (matches the 'id' field in missile_types collection)

MISSILE_GLB_MAP = {
    # ─── Russian Missiles ───────────────────────────────────────────────────
    "kalibr":       "https://drive.google.com/file/d/1OCcK8VFKaeTg56-LGhcr07GwKcs_dYDa/view?usp=sharing",   # Kalibr 3M-54
    "iskander":     "https://drive.google.com/file/d/1IUgEZM1iodI7xKGQJUMGbfU8XGsUF_rY/view?usp=sharing",   # Iskander-M
    "kinzhal":      "https://drive.google.com/file/d/1QlOlLOutQriE4Rob1KV4rzPqx9zg9Hne/view?usp=sharing",   # Kh-47M2 Kinzhal
    "kh101":        "https://drive.google.com/file/d/1Zb9It2R6cHqNvV9UsKwxFgTkMhilvaWi/view?usp=sharing",   # Kh-101
    "shahed136":    "https://drive.google.com/file/d/1ncivJM2gAb8G3a-UlFzL6afeuQfcRoM-/view?usp=sharing",   # Shahed-136

    # ─── Palestinian / Hamas Rockets ─────────────────────────────────────────
    "qassam":       "https://drive.google.com/file/d/1rxnM9utBgIijBV5kTGQz1pcJqeSr2F9Q/view?usp=sharing",   # Qassam-3
    "fateh110":     "https://drive.google.com/file/d/1zKF44742XEIPLBOQSGbnrNyMY8xpNyRh/view?usp=sharing",   # Fateh-110

    # ─── Interceptors / Defense Systems ──────────────────────────────────────
    "irondometamir": "https://drive.google.com/file/d/1B3MXn_oVm3P7ySr-JuWpknIMzODN4Uuf/view?usp=sharing",  # Iron Dome Tamir
    "patriot":      "https://drive.google.com/file/d/1bA7wzecXbnXrHjwu9bK_ujOXVzehXdZi/view?usp=sharing",   # Patriot PAC-3 MSE
    "thaad":        "https://drive.google.com/file/d/1b8q4kYJJkExae06ZG_lpfn54NIC3WN1f/view?usp=sharing",   # THAAD
    "arrow3":       "https://drive.google.com/file/d/1bPt7qSKmceZA8zn9sBODLhbhaYXPqbgT/view?usp=sharing",   # Arrow 3
}

# Google Drive direct download URL template
# Using the export/download endpoint to bypass the preview page
GDRIVE_DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id={file_id}&confirm=t"

def _extract_file_id(value: str) -> str | None:
    """
    Extracts the raw Google Drive file ID from either:
      - A full share URL: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
      - A direct download URL: https://drive.google.com/uc?export=download&id=FILE_ID
      - A raw file ID string: FILE_ID
    Returns None if the value looks like the placeholder or is empty.
    """
    if not value or value.strip() == "REPLACE_WITH_YOUR_GOOGLE_DRIVE_FILE_ID":
        return None

    value = value.strip()

    # Full share URL: https://drive.google.com/file/d/<ID>/view...
    if "/file/d/" in value:
        try:
            after_d = value.split("/file/d/")[1]
            file_id = after_d.split("/")[0].split("?")[0]
            return file_id if file_id else None
        except IndexError:
            return None

    # Direct download URL: .../uc?...&id=<ID>...
    if "id=" in value:
        try:
            after_id = value.split("id=")[1]
            file_id = after_id.split("&")[0].split("?")[0]
            return file_id if file_id else None
        except IndexError:
            return None

    # Assume it's already a raw file ID (no slashes, no spaces)
    if "/" not in value and " " not in value:
        return value

    return None


def get_glb_url(missile_id: str) -> str | None:
    """
    Returns the Google Drive direct-download URL for a given missile ID.
    Accepts full share URLs or raw file IDs in MISSILE_GLB_MAP.
    Returns None if no GLB file is configured for that ID.
    """
    normalized = missile_id.lower().replace("-", "").replace("_", "")
    raw_value  = MISSILE_GLB_MAP.get(normalized)
    file_id    = _extract_file_id(raw_value)

    if not file_id:
        return None

    return GDRIVE_DOWNLOAD_URL.format(file_id=file_id)


def has_glb_model(missile_id: str) -> bool:
    """Returns True if a GLB model is configured for this missile ID."""
    return get_glb_url(missile_id) is not None