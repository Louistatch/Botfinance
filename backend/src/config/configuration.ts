/**
 * Configuration typée de l'application, chargée depuis les variables
 * d'environnement (voir `.env.example`).
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  redis: {
    host: string;
    port: number;
    url: string;
  };
  whatsapp: {
    enabled: boolean;
    authDir: string;
    deviceName: string;
  };
  seed: {
    defaultPassword: string;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_insecure_secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  whatsapp: {
    enabled: (process.env.WHATSAPP_ENABLED ?? 'true') === 'true',
    authDir: process.env.WHATSAPP_AUTH_DIR ?? '.baileys_auth',
    deviceName: process.env.WHATSAPP_DEVICE_NAME ?? 'CreditCEP-AI',
  },
  seed: {
    defaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!',
  },
});
