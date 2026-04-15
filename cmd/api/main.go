package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/graimon31/eanatomy/internal/config"
	"github.com/graimon31/eanatomy/internal/domain/annotation"
	"github.com/graimon31/eanatomy/internal/domain/module"
	"github.com/graimon31/eanatomy/internal/domain/subscription"
	"github.com/graimon31/eanatomy/internal/domain/user"
	adminHandler "github.com/graimon31/eanatomy/internal/handler/admin"
	authHandler "github.com/graimon31/eanatomy/internal/handler/auth"
	editorHandler "github.com/graimon31/eanatomy/internal/handler/editor"
	publicHandler "github.com/graimon31/eanatomy/internal/handler/public"
	"github.com/graimon31/eanatomy/internal/middleware"
	"github.com/graimon31/eanatomy/internal/repository"
	"github.com/graimon31/eanatomy/internal/search"
	"github.com/graimon31/eanatomy/internal/service"
	"github.com/graimon31/eanatomy/internal/storage"
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

	// Auto-migrate database schema
	if err := db.AutoMigrate(
		&user.User{},
		&subscription.Subscription{},
		&subscription.IPAccessRange{},
		&module.Region{},
		&module.Modality{},
		&module.Module{},
		&module.Projection{},
		&module.ImagingMode{},
		&module.Slice{},
		&module.SliceImage{},
		&annotation.TermCategory{},
		&annotation.AnatomicalTerm{},
		&annotation.Annotation{},
	); err != nil {
		log.Fatalf("failed to auto-migrate: %v", err)
	}
	logger.Info("database migration completed")

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

	// MeiliSearch
	searchClient, err := search.NewSearchClient(cfg.MeiliSearch.URL, cfg.MeiliSearch.APIKey)
	if err != nil {
		logger.Warn("MeiliSearch not available", zap.Error(err))
	}

	// Asynq client
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.Redis.Addr()})
	defer asynqClient.Close()

	// Repositories
	userRepo := repository.NewUserRepo(db)
	subRepo := repository.NewSubscriptionRepo(db)
	ipRangeRepo := repository.NewIPAccessRangeRepo(db)
	moduleRepo := repository.NewModuleRepo(db)
	projectionRepo := repository.NewProjectionRepo(db)
	modeRepo := repository.NewImagingModeRepo(db)
	sliceRepo := repository.NewSliceRepo(db)
	sliceImageRepo := repository.NewSliceImageRepo(db)
	annotationRepo := repository.NewAnnotationRepo(db)
	termRepo := repository.NewAnatomicalTermRepo(db)
	categoryRepo := repository.NewTermCategoryRepo(db)
	regionRepo := repository.NewRegionRepo(db)
	modalityRepo := repository.NewModalityRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, subRepo, rdb, cfg.JWT.Secret, cfg.JWT.AccessTTL, cfg.JWT.RefreshTTL)
	userSvc := service.NewUserService(userRepo)
	moduleSvc := service.NewModuleService(moduleRepo, projectionRepo, modeRepo, sliceRepo, sliceImageRepo, minioStorage)
	annotationSvc := service.NewAnnotationService(annotationRepo, termRepo, categoryRepo, searchClient)
	subSvc := service.NewSubscriptionService(subRepo, ipRangeRepo)
	regionSvc := service.NewRegionService(regionRepo, modalityRepo)

	// Handlers
	authH := authHandler.NewAuthHandler(authSvc)
	adminH := adminHandler.NewAdminHandler(userSvc, moduleSvc, annotationSvc, subSvc)
	editorH := editorHandler.NewEditorHandler(moduleSvc, annotationSvc, asynqClient, rdb)
	cidrProvider := func(ctx context.Context) ([]string, error) {
		return ipRangeRepo.GetAllCIDRs()
	}
	publicH := publicHandler.NewPublicHandler(moduleSvc, annotationSvc, regionSvc, rdb, cidrProvider)

	// JWT config for middleware
	jwtCfg := middleware.JWTConfig{
		Secret:     cfg.JWT.Secret,
		AccessTTL:  cfg.JWT.AccessTTL,
		RefreshTTL: cfg.JWT.RefreshTTL,
	}

	// Gin setup
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	// Trust the nginx reverse proxy to set X-Real-IP / X-Forwarded-For.
	_ = r.SetTrustedProxies([]string{"127.0.0.1", "172.16.0.0/12", "10.0.0.0/8"})
	r.Use(gin.Recovery())
	r.Use(middleware.CORSMiddleware([]string{"*"}))

	api := r.Group("/api")

	// Auth routes (rate limited: 10 req/min)
	auth := api.Group("/auth")
	auth.Use(middleware.RateLimitMiddleware(rdb, 10, 1*time.Minute))
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		auth.POST("/refresh", authH.Refresh)
		auth.POST("/logout", authH.Logout)
		auth.GET("/me", middleware.JWTAuth(jwtCfg), authH.GetMe)
		auth.PUT("/me", middleware.JWTAuth(jwtCfg), authH.UpdateMe)
	}

	// Public routes (rate limited: 100 req/min)
	pub := api.Group("")
	pub.Use(middleware.RateLimitMiddleware(rdb, 100, 1*time.Minute))
	{
		pub.GET("/regions", publicH.ListRegions)
		pub.GET("/modalities", publicH.ListModalities)
		pub.GET("/modules", publicH.ListModules)
		pub.GET("/modules/:slug", publicH.GetModule)
		pub.GET("/modules/:slug/slices", publicH.GetModuleSlices)
		pub.GET("/slices/:id/annotations", publicH.GetSliceAnnotations)
		pub.GET("/search", publicH.Search)
		pub.GET("/terms/autocomplete", publicH.Autocomplete)
	}

	// Subscription routes
	subs := api.Group("/subscriptions")
	subs.Use(middleware.JWTAuth(jwtCfg))
	{
		subs.GET("/status", publicH.GetSubscriptionStatus)
	}

	// Editor routes (300 req/min)
	editor := api.Group("/editor")
	editor.Use(middleware.JWTAuth(jwtCfg))
	editor.Use(middleware.RequireRole("editor", "moderator", "super_admin"))
	editor.Use(middleware.RateLimitMiddleware(rdb, 300, 1*time.Minute))
	{
		editor.GET("/modules", editorH.ListModules)
		editor.POST("/modules", editorH.CreateModule)
		editor.PUT("/modules/:id", editorH.UpdateModule)
		editor.DELETE("/modules/:id", editorH.DeleteModule)
		editor.POST("/modules/:id/submit", editorH.SubmitForReview)

		editor.POST("/modules/:id/projections", editorH.CreateProjection)
		editor.DELETE("/projections/:projectionId", editorH.DeleteProjection)

		editor.POST("/modules/:id/modes", editorH.CreateMode)
		editor.DELETE("/modes/:modeId", editorH.DeleteMode)

		editor.POST("/projections/:projectionId/upload", editorH.UploadSlices)
		editor.GET("/tasks/:taskId", editorH.GetTaskProgress)

		editor.GET("/projections/:projectionId/slices", editorH.ListSlices)
		editor.PUT("/slices/:sliceId/reorder", editorH.ReorderSlice)
		editor.DELETE("/slices/:sliceId", editorH.DeleteSlice)

		editor.GET("/slices/:sliceId/annotations", editorH.ListAnnotations)
		editor.POST("/annotations", editorH.CreateAnnotation)
		editor.PUT("/annotations/:annotationId", editorH.UpdateAnnotation)
		editor.DELETE("/annotations/:annotationId", editorH.DeleteAnnotation)
		editor.POST("/slices/:sliceId/annotations/copy-from/:sourceId", editorH.CopyAnnotations)
	}

	// Admin routes (300 req/min)
	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(jwtCfg))
	admin.Use(middleware.RateLimitMiddleware(rdb, 300, 1*time.Minute))
	{
		users := admin.Group("/users")
		users.Use(middleware.RequireRole("super_admin"))
		{
			users.GET("", adminH.ListUsers)
			users.PUT("/:id/role", adminH.ChangeRole)
			users.DELETE("/:id", adminH.DeleteUser)
		}

		modules := admin.Group("/modules")
		modules.Use(middleware.RequireRole("super_admin", "moderator"))
		{
			modules.GET("", adminH.ListModules)
			modules.PUT("/:id/publish", adminH.PublishModule)
			modules.PUT("/:id/reject", adminH.RejectModule)
			modules.DELETE("/:id", adminH.DeleteModule)
		}

		terms := admin.Group("/terms")
		terms.Use(middleware.RequireRole("super_admin"))
		{
			terms.GET("", adminH.ListTerms)
			terms.POST("", adminH.CreateTerm)
			terms.PUT("/:id", adminH.UpdateTerm)
			terms.DELETE("/:id", adminH.DeleteTerm)
			terms.POST("/import", adminH.ImportTermsCSV)
		}

		ipRanges := admin.Group("/ip-ranges")
		ipRanges.Use(middleware.RequireRole("super_admin"))
		{
			ipRanges.GET("", adminH.ListIPRanges)
			ipRanges.POST("", adminH.CreateIPRange)
			ipRanges.DELETE("/:id", adminH.DeleteIPRange)
		}

		subscriptions := admin.Group("/subscriptions")
		subscriptions.Use(middleware.RequireRole("super_admin"))
		{
			subscriptions.GET("", adminH.ListSubscriptions)
			subscriptions.PUT("/:id/cancel", adminH.CancelSubscription)
		}
	}

	_ = logger

	addr := fmt.Sprintf(":%s", cfg.App.Port)
	log.Printf("Starting API server on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
