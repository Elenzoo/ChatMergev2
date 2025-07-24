FROM node:18-slim

# Instalacja zależności systemowych wymaganych przez Puppeteera
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    wget \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Zmienne środowiskowe dla Puppeteera
ENV PUPPETEER_SKIP_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=""
ENV NODE_ENV=production

# Ustawiamy katalog roboczy
WORKDIR /app

# Kopiujemy pliki projektu
COPY . .

# Instalujemy zależności NPM (w tym Puppeteer)
RUN npm install

# Uruchamiamy aplikację
CMD ["node", "server.js"]
