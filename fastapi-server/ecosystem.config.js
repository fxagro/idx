module.exports = {
  apps: [{
    name: 'idx-fastapi-backend',
    script: '/var/www/idx.mytriv.com/fastapi-server/start.py',
    interpreter: '/var/www/idx.mytriv.com/fastapi-server/venv/bin/python',
    args: '-B',
    cwd: '/var/www/idx.mytriv.com/fastapi-server',
    env: { PYTHONUNBUFFERED: '1' },
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '500M',
    watch: ['idx_fastapi'],
    watch_delay: 3000,
    ignore_watch: ['__pycache__', '*.pyc', 'venv', '.env'],
    exp_backoff_restart_delay: 100,
    kill_timeout: 5000,
  }]
}
