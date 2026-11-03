# 0003 Routes register through a default-deny kernel
Status: accepted. Handlers cannot be mounted without declaring roles or public status, which makes "forgot to add auth" a compile-time shape error and a failing test. The same registry generates OpenAPI.
