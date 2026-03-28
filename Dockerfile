FROM heroiclabs/nakama:3.21.1

COPY nakama/dist/main.js /nakama/data/modules/main.js
COPY nakama/local.yml /nakama/data/config/local.yml

EXPOSE 7350 7351

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["DB=$(echo \"$DATABASE_URL\" | sed 's|^postgresql://||' | sed 's|^postgres://||') && echo \"Connecting to: $DB\" && /nakama/nakama migrate up --config /nakama/data/config/local.yml --database.address \"$DB\" && exec /nakama/nakama --config /nakama/data/config/local.yml --database.address \"$DB\""]