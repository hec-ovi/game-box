FROM node:22-bookworm-slim

# The workspace arrives as a mount, installs and all: the built asset pack
# (`assets/dist`) is not in git and cannot be rebuilt from a clean image, so an
# image that copied the repo would come up with no bodies, no clips and no kit.
# So this carries the runtime and nothing else, and the entrypoint runs node
# against the tree it is given.
WORKDIR /app

# the game, and the sidecar it talks to
EXPOSE 5180 8976

ENV GAME_BOX_HOST=0.0.0.0
ENV GAME_BOX_PORT=8976

ENTRYPOINT ["/app/docker-entrypoint.sh"]
