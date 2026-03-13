"""The userlogin app intentionally does not define database models.

Authentication relies on Django's built-in ``User`` model plus associated
``userprofile.Users`` and ``staff.ListModel`` rows.
"""
