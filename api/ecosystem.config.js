module.exports = {
    apps: [
        {
            name: 'node24api',
            script: './index.js',
            instances: 'max', // Use cluster mode across available CPU cores ('max' or 1 for fork mode)
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000,
                ENABLE_CONSOLE_LOG: 'false'
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            merge_logs: true,
            kill_timeout: 5000
        }
    ]
};
