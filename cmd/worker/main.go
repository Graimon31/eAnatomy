package main

import (
	"log"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/graimon31/eanatomy/internal/config"
	"github.com/graimon31/eanatomy/internal/storage"
	"github.com/graimon31/eanatomy/internal/task/dicom"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Database
	db, err := gorm.Open(postgres.Open(cfg.DB.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Redis
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.Redis.Addr(),
	})

	// MinIO
	minioStorage, err := storage.NewMinIOStorage(
		cfg.MinIO.Endpoint,
		cfg.MinIO.AccessKey,
		cfg.MinIO.SecretKey,
		cfg.MinIO.BucketName,
		cfg.MinIO.UseSSL,
	)
	if err != nil {
		log.Fatalf("failed to init MinIO: %v", err)
	}

	// Task handler
	handler := dicom.HandleProcessUpload(db, minioStorage, rdb)

	// Asynq server
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.Redis.Addr()},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"default":  6,
				"critical": 3,
				"low":      1,
			},
		},
	)

	mux := asynq.NewServeMux()
	mux.Handle(dicom.TypeProcessUpload, handler)

	logger.Info("Starting worker")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("failed to start worker: %v", err)
	}
}
