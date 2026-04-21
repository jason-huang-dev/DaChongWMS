from rest_framework.throttling import AnonRateThrottle


class LegacyLoginRateThrottle(AnonRateThrottle):
    scope = "auth_login"


class LegacySignupRateThrottle(AnonRateThrottle):
    scope = "auth_signup"


class SocialAuthBeginRateThrottle(AnonRateThrottle):
    scope = "auth_social_begin"


class SocialAuthProviderListRateThrottle(AnonRateThrottle):
    scope = "auth_social_providers"
