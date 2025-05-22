#!/bin/bash

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Verify we have a Gaia API key
if [ -z "$GAIA_API_KEY" ]; then
  echo "ERROR: GAIA_API_KEY is not set in your .env file. Please add it."
  exit 1
fi

# Confirm Gaia configuration is loaded
echo "Using Gaia API key from .env file"

# Set Gaia model parameters - using Llama-3 as shown in documentation examples
export GAIA_MODEL="Llama-3-8B-Instruct-262k-Q5_K_M"
export GAIA_TEMPERATURE=0.7

# Start the bot
npm run bot:dev
