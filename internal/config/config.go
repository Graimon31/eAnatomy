package config

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	App          AppConfig
	DB           DBConfig
	Redis        RedisConfig
	JWT          JWTConfig
	MinIO        MinIOConfig
	MeiliSearch  MeiliSearchConfig
	Stripe       StripeConfig
	YooKassa     YooKassaConfig
	CDN          CDNConfig
	SMTP         SMTPConfig
}

type AppConfig struct {
	Port string
	Env  string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

func (d DBConfig) DSN() string {
	return "host=" + d.Host +
		" port=" + d.Port +
		" user=" + d.User +
		" password=" + d.Password +
		" dbname=" + d.Name +
		" sslmode=disable"
}

type RedisConfig struct {
	Host string
	Port string
}

func (r RedisConfig) Addr() string {
	return r.Host + ":" + r.Port
}

type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

type MinIOConfig struct {
	Endpoint    string
	AccessKey   string
	SecretKey   string
	BucketName  string
	UseSSL      bool
}

type MeiliSearchConfig struct {
	URL    string
	APIKey string
}

type StripeConfig struct {
	SecretKey     string
	WebhookSecret string
}

type YooKassaConfig struct {
	ShopID    string
	SecretKey string
}

type CDNConfig struct {
	BaseURL string
}

type SMTPConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
}

func Load() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("APP_PORT", "8080")
	viper.SetDefault("APP_ENV", "development")
	viper.SetDefault("DB_HOST", "postgres")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("REDIS_HOST", "redis")
	viper.SetDefault("REDIS_PORT", "6379")
	viper.SetDefault("JWT_ACCESS_TTL", "15m")
	viper.SetDefault("JWT_REFRESH_TTL", "720h")
	viper.SetDefault("MINIO_BUCKET_SLICES", "slices")
	viper.SetDefault("MINIO_USE_SSL", false)
	viper.SetDefault("SMTP_PORT", 587)

	// Read config file (ignore error if not found — env vars are used)
	_ = viper.ReadInConfig()

	accessTTL, err := time.ParseDuration(viper.GetString("JWT_ACCESS_TTL"))
	if err != nil {
		accessTTL = 15 * time.Minute
	}

	refreshTTL, err := time.ParseDuration(viper.GetString("JWT_REFRESH_TTL"))
	if err != nil {
		refreshTTL = 720 * time.Hour
	}

	cfg := &Config{
		App: AppConfig{
			Port: viper.GetString("APP_PORT"),
			Env:  viper.GetString("APP_ENV"),
		},
		DB: DBConfig{
			Host:     viper.GetString("DB_HOST"),
			Port:     viper.GetString("DB_PORT"),
			User:     viper.GetString("DB_USER"),
			Password: viper.GetString("DB_PASSWORD"),
			Name:     viper.GetString("DB_NAME"),
		},
		Redis: RedisConfig{
			Host: viper.GetString("REDIS_HOST"),
			Port: viper.GetString("REDIS_PORT"),
		},
		JWT: JWTConfig{
			Secret:     viper.GetString("JWT_SECRET"),
			AccessTTL:  accessTTL,
			RefreshTTL: refreshTTL,
		},
		MinIO: MinIOConfig{
			Endpoint:   viper.GetString("MINIO_ENDPOINT"),
			AccessKey:  viper.GetString("MINIO_ACCESS_KEY"),
			SecretKey:  viper.GetString("MINIO_SECRET_KEY"),
			BucketName: viper.GetString("MINIO_BUCKET_SLICES"),
			UseSSL:     viper.GetBool("MINIO_USE_SSL"),
		},
		MeiliSearch: MeiliSearchConfig{
			URL:    viper.GetString("MEILISEARCH_URL"),
			APIKey: viper.GetString("MEILISEARCH_API_KEY"),
		},
		Stripe: StripeConfig{
			SecretKey:      viper.GetString("STRIPE_SECRET_KEY"),
			WebhookSecret:  viper.GetString("STRIPE_WEBHOOK_SECRET"),
		},
		YooKassa: YooKassaConfig{
			ShopID:    viper.GetString("YOOKASSA_SHOP_ID"),
			SecretKey: viper.GetString("YOOKASSA_SECRET_KEY"),
		},
		CDN: CDNConfig{
			BaseURL: viper.GetString("CDN_BASE_URL"),
		},
		SMTP: SMTPConfig{
			Host:     viper.GetString("SMTP_HOST"),
			Port:     viper.GetInt("SMTP_PORT"),
			User:     viper.GetString("SMTP_USER"),
			Password: viper.GetString("SMTP_PASSWORD"),
			From:     viper.GetString("SMTP_FROM"),
		},
	}

	return cfg, nil
}
