# 0004 Public site is static HTML separate from the app
Status: accepted. Search engines index the server-rendered pages at `/`; the client-rendered app under `/app` is noindex via header and meta tag. robots.txt does not block `/app` because a blocked page cannot show its noindex. No structured data that implies reviews or ratings is published because none exist.
