package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware returns a Gin middleware that handles Cross-Origin Resource
// Sharing. allowedOrigins is the list of origins permitted to access the API
// (e.g. ["https://eanatomy.example.com"]).
//
// Note: AllowCredentials requires explicit origins — wildcard "*" is not
// permitted by the spec when credentials are involved.
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	cfg := cors.Config{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{
			"GET",
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		},
		AllowHeaders: []string{
			"Authorization",
			"Content-Type",
			"Accept",
			"Origin",
			"X-Requested-With",
		},
		ExposeHeaders: []string{
			"Content-Length",
			"Content-Type",
		},
		MaxAge: 12 * time.Hour,
	}

	// AllowCredentials is only valid with explicit origins.
	hasWildcard := false
	for _, o := range allowedOrigins {
		if o == "*" {
			hasWildcard = true
			break
		}
	}
	if !hasWildcard {
		cfg.AllowCredentials = true
	}

	return cors.New(cfg)
}
