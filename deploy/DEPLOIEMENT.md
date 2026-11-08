# Déploiement RomaTerra sur un VPS OVH

Architecture : un VPS Ubuntu 24.04 avec nginx + Node (pm2), base MongoDB Atlas.

| Adresse | Contenu | Dossier sur le serveur |
|---|---|---|
| `artifact-ceramics.tn` / `www.artifact-ceramics.tn` | boutique (`romaterra-frontend`) | `/var/www/romaterra-shop` |
| `admin.artifact-ceramics.tn` | dashboard (`romaterra-dashboard`) | `/var/www/romaterra-admin` |
| `api.artifact-ceramics.tn` | backend (ce dépôt) | `/home/deploy/romaterra-backend` |

Remplacer `artifact-ceramics.tn` partout si le domaine est différent.

---

## 1. Commander et préparer

- [ ] **VPS OVH** (2 vCPU / 4 Go suffisent), image **Ubuntu 24.04**. Noter l'IP.
- [ ] **MongoDB Atlas** : créer un cluster, un utilisateur limité à la base `romaterra`, et dans *Network Access* autoriser **uniquement l'IP du VPS**. Copier l'URI `mongodb+srv://…`.
- [ ] **DNS** (zone du domaine) : enregistrements **A** vers l'IP du VPS pour `@`, `www`, `admin`, `api`.

## 2. Sécuriser le VPS

```bash
ssh ubuntu@IP_DU_VPS
sudo apt update && sudo apt upgrade -y
sudo adduser deploy && sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh && sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && sudo chown -R deploy:deploy /home/deploy/.ssh
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Vérifier que `ssh deploy@IP_DU_VPS` fonctionne, **puis** dans `/etc/ssh/sshd_config` :
`PermitRootLogin no` et `PasswordAuthentication no`, puis `sudo systemctl restart ssh`.

## 3. Installer Node, nginx, pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
```

## 4. Backend

```bash
cd ~ && git clone -b securite-hebergement https://github.com/Amadou2sire/romaterra-backend.git
cd romaterra-backend && npm ci --omit=dev
cp .env.example .env && nano .env      # remplir toutes les valeurs
chmod 600 .env
pm2 start deploy/ecosystem.config.js
pm2 save && pm2 startup                # exécuter la commande sudo affichée
curl http://127.0.0.1:3000             # -> "Romaterra backend is running"
```

Premier compte admin : mettre `ALLOW_ADMIN_REGISTER=true`, `pm2 restart romaterra-api`, créer le compte
(`POST https://api.artifact-ceramics.tn/auth/register` avec `email` et `password`), puis remettre `false` et redémarrer.

## 5. Boutique et dashboard (compilés sur votre PC)

Dans **`romaterra-frontend`**, créer `.env.production` :
```
REACT_APP_API_URL=https://api.artifact-ceramics.tn
REACT_APP_META_PIXEL_ID=votre_id_pixel
```
Dans **`romaterra-dashboard`**, créer `.env.production` :
```
REACT_APP_API_URL=https://api.artifact-ceramics.tn
```
Puis dans chacun : `npm ci && npm run build`, et envoyer le dossier `build/` :
```bash
ssh deploy@IP_DU_VPS "sudo mkdir -p /var/www/romaterra-shop /var/www/romaterra-admin && sudo chown deploy /var/www/romaterra-*"
scp -r romaterra-frontend/build/* deploy@IP_DU_VPS:/var/www/romaterra-shop/
scp -r romaterra-dashboard/build/* deploy@IP_DU_VPS:/var/www/romaterra-admin/
```

## 6. nginx

```bash
sudo cp ~/romaterra-backend/deploy/nginx-romaterra.conf /etc/nginx/sites-available/romaterra
sudo ln -s /etc/nginx/sites-available/romaterra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 7. HTTPS (Let's Encrypt, gratuit)

Une fois que les DNS pointent bien vers le VPS :
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d artifact-ceramics.tn -d www.artifact-ceramics.tn -d admin.artifact-ceramics.tn -d api.artifact-ceramics.tn --redirect
```
Le renouvellement est automatique. Quand tout marche en HTTPS, ajouter dans chaque bloc `server` :
`add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`

## 8. Vérifications

- [ ] `https://api.artifact-ceramics.tn` affiche « Romaterra backend is running ».
- [ ] La boutique charge les produits, une commande test passe, l'e-mail admin arrive.
- [ ] Le dashboard se connecte ; annuler la commande test remet le stock.
- [ ] Meta Pixel Helper (extension Chrome) voit PageView / AddToCart / Purchase.
- [ ] Console du navigateur sur la boutique : aucune violation CSP → passer
      `Content-Security-Policy-Report-Only` en `Content-Security-Policy`.
- [ ] Mettre à jour `public/sitemap.xml` (encore sur l'ancien domaine du template) et `robots.txt`.
- [ ] Activer les sauvegardes dans Atlas.

## Mises à jour

```bash
# Backend
cd ~/romaterra-backend && git pull && npm ci --omit=dev && pm2 restart romaterra-api
# Frontends : recompiler sur le PC puis refaire les scp de l'étape 5
```

Logs : `pm2 logs romaterra-api` · nginx : `/var/log/nginx/error.log`.
