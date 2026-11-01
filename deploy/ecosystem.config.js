// pm2 start deploy/ecosystem.config.js   (depuis le dossier romaterra-backend)
module.exports = {
  apps: [
    {
      name: 'romaterra-api',
      script: 'index.js',
      cwd: __dirname + '/..',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
