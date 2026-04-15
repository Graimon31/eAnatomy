package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// RateLimitMiddleware returns a Gin middleware that enforces per-client rate
// limiting using Redis.
//
// For authenticated requests (where "userID" is set in the context by JWTAuth),
// the rate limit key is "rate:user:{userID}". For unauthenticated requests,
// the key is "rate:{ip}".
//
// limit specifies the maximum number of requests allowed within the given
// window duration.
func RateLimitMiddleware(redisClient *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		key := rateLimitKey(c)

		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			// If Redis is unreachable, allow the request through rather than
			// blocking all traffic.
			c.Next()
			return
		}

		// Set expiry only when the counter is first created (count == 1).
		if count == 1 {
			redisClient.Expire(ctx, key, window)
		}

		if count > int64(limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"detail": "Слишком много запросов",
				"code":   "RATE_LIMIT_EXCEEDED",
			})
			return
		}

		c.Next()
	}
}

// rateLimitKey returns the Redis key used for rate limiting the current
// request. Authenticated users get a per-user key; anonymous clients get
// an IP-based key.
func rateLimitKey(c *gin.Context) string {
	if uid, exists := c.Get("userID"); exists {
		if userID, ok := uid.(uuid.UUID); ok {
			return fmt.Sprintf("rate:user:%s", userID.String())
		}
	}
	return fmt.Sprintf("rate:%s", c.ClientIP())
}
