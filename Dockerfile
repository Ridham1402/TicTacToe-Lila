# Dockerfile for Render.com deployment.
# The Nakama JS module must be pre-built locally (`cd nakama && node build.js`)
# before building this Docker image. The built dist/main.js is copied in.

FROM heroiclabs/nakama:3.21.1

# Copy the pre-built JS module bundle
COPY nakama/dist/main.js /nakama/data/modules/main.js

# Copy the Nakama server config
COPY nakama/local.yml /nakama/data/config/local.yml

# Expose HTTP/WebSocket API (7350) and console (7351)
EXPOSE 7350 7351

# Nakama reads DATABASE_URL from environment (set in Render env vars)
# Run DB migrations then start the server
CMD ["/bin/sh", "-c", \
  "DB=$(echo $DATABASE_URL | sed 's|postgresql://||' | sed 's|postgres://||') && \
  /nakama/nakama migrate up --config /nakama/data/config/local.yml --database.address $DB && \
  /nakama/nakama --config /nakama/data/config/local.yml --database.address $DB"]
