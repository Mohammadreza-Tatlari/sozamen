# Sozamen Setup and Deployment Guide

This guide explains how to install, configure, and run the Sozamen Next.js application locally or on a Linux server.

## 1. Server requirements

Install the following tools before uploading the project:

- Node.js 20 LTS or newer
- npm 10 or newer
- A Linux user with permission to write inside the project directory
- A process manager such as systemd or PM2 for a long-running production service
- Nginx or another reverse proxy if the site will use a public domain and HTTPS

Check the installed versions:

```bash
node --version
npm --version
```

## 2. Upload the project

Upload or clone the project into a dedicated directory. Example:

```bash
cd /var/www
git clone YOUR_REPOSITORY_URL sozamen-shop
cd sozamen-shop
```

If the project is uploaded as an archive, extract it and enter the extracted directory instead.

Do not upload `node_modules` or `.next`. These directories are generated on the server.

## 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-this-with-a-long-random-secret"
```

Generate a suitable session secret on Linux:

```bash
openssl rand -hex 32
```

Paste the generated value into `SESSION_SECRET`. Do not commit the production `.env` file to Git or share its contents publicly.

The relative SQLite path above stores the database at `prisma/dev.db`.

## 4. Install dependencies

When `package-lock.json` is available, use the reproducible installation command:

```bash
npm ci
```

Use the following command only when there is no lockfile or when intentionally updating dependencies:

```bash
npm install
```

## 5. Generate Prisma and initialize SQLite

Generate the Prisma client and apply the current schema:

```bash
npx prisma generate
npx prisma db push
```

For the first installation, seed the demo administrator, customer, and products:

```bash
npm run db:seed
```

Do not run the seed command during every restart. It is intended for the first setup or for explicitly restoring the included demo records.

Demo accounts created by the seed script:

- Administrator: `09120000000`
- Customer: `09121111111`
- Mock OTP: any 4 to 6 digit number, such as `1234`

## 6. Run in development mode

Start the development server on the default port, `3000`:

```bash
npm run dev
```

Start it on a specific port, such as `4000`:

```bash
npm run dev -- -p 4000
```

Development mode supports automatic refresh and should not be used as the permanent public production process.

## 7. Build and run in production

Create an optimized production build:

```bash
npm run build
```

Start production on port `3000`:

```bash
npm start -- -p 3000
```

Start production on a different port:

```bash
npm start -- -p 4000
```

To listen on all network interfaces as well as a selected port:

```bash
npm start -- -H 0.0.0.0 -p 4000
```

When using Nginx on the same server, binding the application to `127.0.0.1` is preferable because Nginx will receive public traffic and forward it to Next.js:

```bash
npm start -- -H 127.0.0.1 -p 3000
```

## 8. Keep the application running with systemd

Create `/etc/systemd/system/sozamen.service` with values adjusted for your server user and project path:

```ini
[Unit]
Description=Sozamen Next.js Shop
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sozamen-shop
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sozamen
sudo systemctl status sozamen
```

View recent application logs:

```bash
sudo journalctl -u sozamen -n 100 --no-pager
```

## 9. Nginx reverse proxy example

The following is a minimal HTTP configuration. Replace `shop.example.com` with the real domain:

```nginx
server {
    listen 80;
    server_name shop.example.com;

    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Validate and reload Nginx after enabling the site:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Use a trusted TLS tool such as Certbot to add HTTPS before accepting real customer information.

## 10. Persistent files and backups

This MVP stores persistent data locally. Preserve these paths during deployments:

- `prisma/dev.db` - users, products, comments, and orders
- `public/uploads/products/` - uploaded product images
- `public/uploads/profiles/` - uploaded profile pictures
- `.env` - database location and session secret

Back up the SQLite database and uploaded images regularly. Do not replace these directories when deploying a new application version.

Because uploads are stored inside `public`, a build or code synchronization command that replaces the project directory can delete customer files. On a production server, use a persistent shared directory or volume and link it to the expected upload paths.

For a multi-server deployment, migrate SQLite to a shared database and local uploads to object storage before distributing traffic across multiple application instances.

## 11. Deploy an update

From the project directory:

```bash
git pull
npm ci
npx prisma generate
npx prisma db push
npm run build
sudo systemctl restart sozamen
```

Do not run `npm run db:seed` during routine updates.

## 12. Verify the deployment

Check the application directly on its local port:

```bash
curl -I http://127.0.0.1:3000
```

Then verify these public flows:

1. Open the home and shop pages.
2. Log in with a test account.
3. Open the profile from the account icon.
4. Add a product to the cart and complete the mock checkout.
5. Confirm that the order appears in the customer profile.
6. Confirm that product and profile image uploads remain available after a restart.

## 13. Common commands

| Task                       | Command                  |
| -------------------------- | ------------------------ |
| Install exact dependencies | `npm ci`                 |
| Development on port 3000   | `npm run dev`            |
| Development on port 4000   | `npm run dev -- -p 4000` |
| Apply the database schema  | `npx prisma db push`     |
| Seed demo data             | `npm run db:seed`        |
| Create a production build  | `npm run build`          |
| Production on port 3000    | `npm start -- -p 3000`   |
| Production on port 4000    | `npm start -- -p 4000`   |
